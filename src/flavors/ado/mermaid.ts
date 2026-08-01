import type MarkdownIt from "markdown-it";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";

const OPEN_PATTERN = /^:::\s*mermaid\s*$/i;
const CLOSE_PATTERN = /^:::\s*$/;

/**
 * Azure DevOps Wiki wraps diagrams in `::: mermaid` fences. They are turned into
 * ordinary `mermaid` fenced code blocks so the frontend has a single shape to
 * render, whichever syntax the source used.
 */
export function adoMermaidPlugin(md: MarkdownIt): void {
  md.block.ruler.before("fence", "ado_mermaid", mermaidRule, {
    alt: ["paragraph", "reference", "blockquote", "list"],
  });
}

function mermaidRule(
  state: StateBlock,
  startLine: number,
  endLine: number,
  silent: boolean,
): boolean {
  if (!OPEN_PATTERN.test(lineAt(state, startLine))) {
    return false;
  }
  if (silent) {
    return true;
  }

  let line = startLine + 1;
  let closed = false;
  while (line < endLine) {
    if (CLOSE_PATTERN.test(lineAt(state, line))) {
      closed = true;
      break;
    }
    line += 1;
  }

  const token = state.push("fence", "code", 0);
  token.info = "mermaid";
  token.markup = "```";
  token.content = state.getLines(startLine + 1, line, 0, false);
  token.map = [startLine, line + 1];
  state.line = closed ? line + 1 : line;
  return true;
}

function lineAt(state: StateBlock, line: number): string {
  return state.src.slice(state.bMarks[line] + state.tShift[line], state.eMarks[line]).trim();
}
