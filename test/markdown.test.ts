import { describe, expect, test } from "bun:test";
import { extractHeadings, preprocessMarkdown, renderMarkdown } from "../src/markdown.ts";

describe("Markdown rendering", () => {
  test("preprocesses Azure DevOps Mermaid blocks", () => {
    expect(preprocessMarkdown("::: mermaid\nflowchart LR\n  A --> B\n:::\n")).toContain(
      "```mermaid",
    );
  });

  test("extracts unique heading ids", () => {
    expect(extractHeadings("# Intro\n## Intro\n")).toEqual([
      { id: "intro", text: "Intro", level: 1 },
      { id: "intro-1", text: "Intro", level: 2 },
    ]);
  });

  test("renders TOC and rewrites local links and assets", () => {
    const result = renderMarkdown(
      "Guide/Intro.md",
      "# Intro\n\n[[_TOC_]]\n\n[Next](Next.md#Part)\n![Diagram](../.attachments/diagram.png)\n[External](https://example.com)\n",
    );

    expect(result.html).toContain('<h1 id="intro">Intro</h1>');
    expect(result.html).toContain('href="#intro"');
    expect(result.html).toContain('href="/?path=Guide%2FNext.md#Part"');
    expect(result.html).toContain('src="/api/asset?path=.attachments%2Fdiagram.png"');
    expect(result.html).toContain('href="https://example.com"');
  });

  test("renders raw HTML and task lists", () => {
    const result = renderMarkdown("Home.md", "<mark>ok</mark>\n\n- [x] done\n");
    expect(result.html).toContain("<mark>ok</mark>");
    expect(result.html).toContain('type="checkbox"');
  });
});
