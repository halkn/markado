import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "../../src/core/markdown.ts";
import { plainFlavor } from "../../src/flavors/plain.ts";

const render = (pagePath: string, source: string) => renderMarkdown(plainFlavor, pagePath, source);

describe("GFM baseline", () => {
  test("renders tables", () => {
    const html = render("Home.md", "| a | b |\n| - | - |\n| 1 | 2 |\n").html;
    expect(html).toContain("<table>");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
  });

  test("renders task lists", () => {
    const html = render("Home.md", "- [x] done\n- [ ] todo\n").html;
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked");
  });

  test("renders strikethrough", () => {
    expect(render("Home.md", "~~gone~~\n").html).toContain("<s>gone</s>");
  });

  test("autolinks bare and bracketed URLs", () => {
    expect(render("Home.md", "<https://example.com>\n").html).toContain(
      'href="https://example.com"',
    );
    expect(render("Home.md", "See https://example.com today\n").html).toContain(
      'href="https://example.com"',
    );
  });

  test("keeps raw HTML for trusted local documents", () => {
    expect(render("Home.md", "<mark>ok</mark>\n").html).toContain("<mark>ok</mark>");
  });
});

describe("headings", () => {
  test("assigns unique ids to repeated headings", () => {
    const result = render("Home.md", "# Intro\n## Intro\n### Intro\n");
    expect(result.headings).toEqual([
      { id: "intro", text: "Intro", level: 1 },
      { id: "intro-1", text: "Intro", level: 2 },
      { id: "intro-2", text: "Intro", level: 3 },
    ]);
    expect(result.html).toContain('<h1 id="intro">');
    expect(result.html).toContain('<h2 id="intro-1">');
    expect(result.html).toContain('<h3 id="intro-2">');
  });

  test("slugifies non-ASCII headings", () => {
    expect(render("Home.md", "# はじめに\n").headings[0]?.id).toBe("はじめに");
  });

  test("falls back to the page name when there is no heading", () => {
    expect(render("Guide/Intro.md", "text only\n").title).toBe("Guide/Intro");
  });
});

describe("references", () => {
  test("rewrites local links and images, leaving external URLs alone", () => {
    const html = render(
      "Guide/Intro.md",
      "[Next](Next.md#Part)\n![Diagram](../.attachments/diagram.png)\n[External](https://example.com)\n",
    ).html;

    expect(html).toContain('href="/?path=Guide%2FNext.md#Part"');
    expect(html).toContain('data-mdiv-kind="page"');
    expect(html).toContain('data-mdiv-path="Guide/Next.md"');
    expect(html).toContain('src="/api/asset?path=.attachments%2Fdiagram.png"');
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain('href="/?path=https');
  });

  test("leaves in-page anchors as anchors", () => {
    const html = render("Home.md", "# Intro\n\n[Jump](#intro)\n").html;
    expect(html).toContain('href="#intro"');
  });
});
