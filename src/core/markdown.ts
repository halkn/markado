import MarkdownIt from "markdown-it";
import type { RenderRule } from "markdown-it/lib/renderer.mjs";
import type Token from "markdown-it/lib/token.mjs";
import taskLists from "markdown-it-task-lists";
import type { Flavor } from "../flavors/types.ts";
import type { Heading, RenderResponse } from "../types.ts";
import { linkDataAttributes, resolveLinkTarget, toHref } from "./links.ts";
import { stripMarkdownExtension } from "./path.ts";
import { sanitizeRawHtml } from "./sanitize.ts";

/**
 * Render-time state shared with flavor plugins. `headings` is filled in before
 * rendering starts, so a `[[_TOC_]]` renderer can rely on it being complete.
 */
export type RenderEnv = {
  pagePath: string;
  headings: Heading[];
};

const renderers = new WeakMap<Flavor, MarkdownIt>();

export function getRenderer(flavor: Flavor): MarkdownIt {
  const cached = renderers.get(flavor);
  if (cached) {
    return cached;
  }

  const renderer = createRenderer(flavor);
  renderers.set(flavor, renderer);
  return renderer;
}

export function createRenderer(flavor: Flavor): MarkdownIt {
  const renderer = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  }).use(taskLists, { enabled: false });

  installLinkRewriter(renderer, flavor);
  installHtmlSanitizer(renderer);
  for (const plugin of flavor.markdownItPlugins ?? []) {
    renderer.use(plugin);
  }

  return renderer;
}

/**
 * Parse once, assign heading ids, then render. Deriving the outline and the
 * HTML from the same token stream is what keeps `[[_TOC_]]` anchors and the
 * heading ids in the body from drifting apart when headings repeat.
 */
export function renderMarkdown(flavor: Flavor, pagePath: string, source: string): RenderResponse {
  const renderer = getRenderer(flavor);
  const env: RenderEnv = { pagePath, headings: [] };
  const tokens = renderer.parse(source, env);
  env.headings = assignHeadingIds(tokens);
  const html = renderer.renderer.render(tokens, renderer.options, env);

  return {
    path: pagePath,
    title: env.headings[0]?.text ?? stripMarkdownExtension(pagePath),
    html,
    headings: env.headings,
  };
}

export function extractHeadings(flavor: Flavor, source: string): Heading[] {
  return assignHeadingIds(getRenderer(flavor).parse(source, { pagePath: "", headings: [] }));
}

/** Sets the `id` attribute on every `heading_open` token and returns the outline. */
export function assignHeadingIds(tokens: Token[]): Heading[] {
  const used = new Map<string, number>();
  const headings: Heading[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open") {
      continue;
    }

    const text = tokens[index + 1]?.content ?? "";
    const id = slugifyHeading(text, used);
    token.attrSet("id", id);
    headings.push({ id, text, level: Number(token.tag.slice(1)) });
  }

  return headings;
}

export function slugifyHeading(text: string, used = new Map<string, number>()): string {
  const base =
    text
      .trim()
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "heading";
  const count = used.get(base) ?? 0;
  used.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

const renderToken: RenderRule = (tokens, index, options, _env, self) =>
  self.renderToken(tokens, index, options);

/**
 * `html: true` stays on, but the document decides nothing on its own: raw HTML
 * reaches the browser only through the allowlist in `sanitize.ts`. Filtering the
 * tokens rather than the rendered string keeps the renderer's own markup — the
 * `data-mdiv-*` attributes, `[[_TOC_]]`, the Mermaid fence — out of the scan.
 */
function installHtmlSanitizer(renderer: MarkdownIt): void {
  const sanitize: RenderRule = (tokens, index) => sanitizeRawHtml(tokens[index].content);
  renderer.renderer.rules.html_block = sanitize;
  renderer.renderer.rules.html_inline = sanitize;
}

function installLinkRewriter(renderer: MarkdownIt, flavor: Flavor): void {
  const defaultLinkOpen = renderer.renderer.rules.link_open ?? renderToken;
  const defaultImage = renderer.renderer.rules.image ?? renderToken;

  renderer.renderer.rules.link_open = (tokens, index, options, env, self) => {
    rewriteReference(flavor, tokens[index], "href", env as RenderEnv, false);
    return defaultLinkOpen(tokens, index, options, env, self);
  };

  renderer.renderer.rules.image = (tokens, index, options, env, self) => {
    rewriteReference(flavor, tokens[index], "src", env as RenderEnv, true);
    return defaultImage(tokens, index, options, env, self);
  };
}

function rewriteReference(
  flavor: Flavor,
  token: Token,
  attribute: "href" | "src",
  env: RenderEnv,
  forceAsset: boolean,
): void {
  const raw = token.attrGet(attribute);
  if (!raw) {
    return;
  }

  const pagePath = env.pagePath ?? "";
  const options = { forceAsset };
  const target =
    flavor.resolveLink?.(pagePath, raw, options) ?? resolveLinkTarget(pagePath, raw, options);

  token.attrSet(attribute, toHref(target));
  for (const [name, value] of Object.entries(linkDataAttributes(target))) {
    token.attrSet(name, value);
  }
}
