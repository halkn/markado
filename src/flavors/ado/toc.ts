import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type { RenderEnv } from "../../core/markdown.ts";
import type { Heading } from "../../types.ts";

const TOC_MARKER = "[[_TOC_]]";
const TOC_TOKEN = "ado_toc";

/**
 * Azure DevOps Wiki's `[[_TOC_]]` marker. Implemented as a block rule rather
 * than a source-level substitution so the marker is ignored inside code blocks,
 * and so the rendered anchors come from the same heading ids as the body.
 */
export function adoTocPlugin(md: MarkdownIt): void {
  md.block.ruler.before("paragraph", TOC_TOKEN, tocRule, {
    alt: ["paragraph", "reference", "blockquote"],
  });

  md.renderer.rules[TOC_TOKEN] = (_tokens, _index, _options, env) =>
    renderToc(md, (env as RenderEnv).headings ?? []);
}

function tocRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  const start = state.bMarks[startLine] + state.tShift[startLine];
  const max = state.eMarks[startLine];
  if (state.src.slice(start, max).trim() !== TOC_MARKER) {
    return false;
  }
  if (silent) {
    return true;
  }

  const token = state.push(TOC_TOKEN, "", 0);
  token.markup = TOC_MARKER;
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

function renderToc(md: MarkdownIt, headings: Heading[]): string {
  if (headings.length === 0) {
    return "";
  }

  const items = headings
    .map(
      (heading) =>
        `<li class="markado-toc-item markado-toc-level-${heading.level}">` +
        `<a href="#${encodeURIComponent(heading.id)}">${md.utils.escapeHtml(heading.text)}</a></li>`,
    )
    .join("\n");

  return `<nav class="markado-toc">\n<ul>\n${items}\n</ul>\n</nav>\n`;
}
