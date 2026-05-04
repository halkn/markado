import MarkdownIt from "markdown-it";
import taskLists from "markdown-it-task-lists";
import {
  isLocalReference,
  isMarkdownPath,
  normalizeRootRelativePath,
  resolveMarkdownRelativePath,
} from "./path.ts";
import type { Heading, RenderResponse } from "./types.ts";

const markdown = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: false,
}).use(taskLists, { enabled: false });

export function preprocessMarkdown(source: string): string {
  return source.replace(/^:::\s*mermaid\s*\n([\s\S]*?)^:::\s*$/gim, "```mermaid\n$1\n```");
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

export function renderMarkdown(pagePath: string, source: string): RenderResponse {
  const preprocessed = preprocessMarkdown(source);
  const headings = extractHeadings(preprocessed.replaceAll("[[_TOC_]]", ""));
  const withToc = preprocessed.replaceAll("[[_TOC_]]", renderTocMarkdown(headings));
  const html = renderHtml(pagePath, withToc);

  return {
    path: pagePath,
    title: headings[0]?.text ?? pagePath.replace(/\.md$/i, ""),
    html,
    headings,
  };
}

export function extractHeadings(source: string): Heading[] {
  const tokens = markdown.parse(source, {});
  const used = new Map<string, number>();
  const headings: Heading[] = [];

  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token.type !== "heading_open") {
      continue;
    }

    const inline = tokens[index + 1];
    const text = inline?.content ?? "";
    const level = Number(token.tag.slice(1));
    headings.push({
      id: slugifyHeading(text, used),
      text,
      level,
    });
  }

  return headings;
}

function renderHtml(pagePath: string, source: string): string {
  const renderer = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: false,
  }).use(taskLists, { enabled: false });
  installHeadingIds(renderer);
  installLinkRewriter(renderer, pagePath);
  return renderer.render(source);
}

function installHeadingIds(renderer: MarkdownIt): void {
  const defaultRender =
    renderer.renderer.rules.heading_open ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  const used = new Map<string, number>();

  renderer.renderer.rules.heading_open = (tokens, index, options, env, self) => {
    const inline = tokens[index + 1];
    const id = slugifyHeading(inline?.content ?? "", used);
    tokens[index].attrSet("id", id);
    return defaultRender(tokens, index, options, env, self);
  };
}

function installLinkRewriter(renderer: MarkdownIt, pagePath: string): void {
  const defaultLinkOpen =
    renderer.renderer.rules.link_open ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));
  const defaultImage =
    renderer.renderer.rules.image ??
    ((tokens, index, options, _env, self) => self.renderToken(tokens, index, options));

  renderer.renderer.rules.link_open = (tokens, index, options, env, self) => {
    const href = tokens[index].attrGet("href");
    if (href) {
      tokens[index].attrSet("href", rewriteReference(pagePath, href, false));
    }
    return defaultLinkOpen(tokens, index, options, env, self);
  };

  renderer.renderer.rules.image = (tokens, index, options, env, self) => {
    const src = tokens[index].attrGet("src");
    if (src) {
      tokens[index].attrSet("src", rewriteReference(pagePath, src, true));
    }
    return defaultImage(tokens, index, options, env, self);
  };
}

function rewriteReference(pagePath: string, value: string, forceAsset: boolean): string {
  if (!isLocalReference(value)) {
    return value;
  }

  const [rawPath, hash = ""] = value.split("#", 2);
  if (!rawPath) {
    return value;
  }

  const decoded = decodeURI(rawPath);
  const resolved = resolveMarkdownRelativePath(pagePath, decoded);
  if (resolved.startsWith("../") || resolved === "..") {
    return value;
  }

  if (!forceAsset && isMarkdownPath(resolved)) {
    const encoded = encodeURIComponent(normalizeRootRelativePath(resolved));
    return hash ? `/?path=${encoded}#${encodeURIComponent(hash)}` : `/?path=${encoded}`;
  }

  const encoded = encodeURIComponent(normalizeRootRelativePath(resolved));
  return hash
    ? `/api/asset?path=${encoded}#${encodeURIComponent(hash)}`
    : `/api/asset?path=${encoded}`;
}

function renderTocMarkdown(headings: Heading[]): string {
  if (headings.length === 0) {
    return "";
  }

  return `${headings
    .map((heading) => {
      const indent = "  ".repeat(Math.max(0, heading.level - 1));
      return `${indent}- [${heading.text}](#${heading.id})`;
    })
    .join("\n")}\n`;
}
