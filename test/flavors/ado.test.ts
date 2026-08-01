import { describe, expect, test } from "bun:test";
import { renderMarkdown } from "../../src/core/markdown.ts";
import { scanWiki } from "../../src/core/tree.ts";
import { adoFlavor } from "../../src/flavors/ado/index.ts";
import { createWiki, nodeNames, wikiContext } from "../helpers/wiki.ts";

const render = (pagePath: string, source: string) => renderMarkdown(adoFlavor, pagePath, source);

describe("ADO tree conventions", () => {
  test("applies .order, hides dot entries, and merges page folders", async () => {
    const root = createWiki({
      ".order": "Guide\nHome.md\n",
      "Home.md": "# Home\n",
      "Guide.md": "# Guide\n",
      "Zed.md": "# Zed\n",
      "Guide/.order": "Reference\nInstall\n",
      "Guide/Install.md": "# Install\n",
      "Guide/Reference.md": "# Reference\n",
      ".hidden/Secret.md": "# Secret\n",
      ".attachments/diagram.png": "png",
    });

    const tree = await scanWiki(wikiContext(root, adoFlavor));

    expect(tree.flavor).toBe("ado");
    expect(tree.files).toEqual([
      "Guide.md",
      "Guide/Reference.md",
      "Guide/Install.md",
      "Home.md",
      "Zed.md",
    ]);
    expect(nodeNames(tree.root.children)).toEqual(["Guide", "Home", "Zed"]);
    expect(tree.root.children[0]).toMatchObject({
      name: "Guide",
      path: "Guide.md",
      kind: "file",
    });
    expect(nodeNames(tree.root.children[0]?.children ?? [])).toEqual(["Reference", "Install"]);
  });

  test("matches .order entries case-insensitively and with or without .md", async () => {
    const root = createWiki({
      ".order": "zed.md\nALPHA\n",
      "Alpha.md": "# Alpha\n",
      "Zed.md": "# Zed\n",
    });

    const tree = await scanWiki(wikiContext(root, adoFlavor));
    expect(nodeNames(tree.root.children)).toEqual(["Zed", "Alpha"]);
  });

  test("sorts pages missing from .order after the listed ones", async () => {
    const root = createWiki({
      ".order": "Zed\n",
      "Alpha.md": "# Alpha\n",
      "Beta.md": "# Beta\n",
      "Zed.md": "# Zed\n",
    });

    const tree = await scanWiki(wikiContext(root, adoFlavor));
    expect(nodeNames(tree.root.children)).toEqual(["Zed", "Alpha", "Beta"]);
  });

  test("handles Japanese and space-containing page names", async () => {
    const root = createWiki({
      ".order": "ガイド\nGetting Started\n",
      "ガイド.md": "# ガイド\n",
      "Getting Started.md": "# Getting Started\n",
      "ガイド/インストール.md": "# インストール\n",
    });

    const tree = await scanWiki(wikiContext(root, adoFlavor));
    expect(nodeNames(tree.root.children)).toEqual(["ガイド", "Getting Started"]);
    expect(tree.files).toEqual(["ガイド.md", "ガイド/インストール.md", "Getting Started.md"]);
  });
});

describe("ADO Markdown syntax", () => {
  test("renders [[_TOC_]] with anchors that match the heading ids in the body", () => {
    const result = render("Home.md", "# Intro\n\n[[_TOC_]]\n\n## Intro\n\n## Setup\n");

    expect(result.headings.map((heading) => heading.id)).toEqual(["intro", "intro-1", "setup"]);
    for (const heading of result.headings) {
      expect(result.html).toContain(`href="#${heading.id}"`);
      expect(result.html).toContain(`id="${heading.id}"`);
    }
  });

  test("renders nothing for [[_TOC_]] on a page without headings", () => {
    expect(render("Home.md", "[[_TOC_]]\n\ntext\n").html).not.toContain("mdiv-toc");
  });

  test("leaves [[_TOC_]] alone inside a fenced code block", () => {
    const html = render("Home.md", "# Intro\n\n```\n[[_TOC_]]\n```\n").html;
    expect(html).toContain("[[_TOC_]]");
    expect(html).not.toContain("mdiv-toc");
  });

  test("turns ::: mermaid blocks into mermaid fences", () => {
    const html = render("Home.md", "::: mermaid\nflowchart LR\n  A --> B\n:::\n").html;
    expect(html).toContain('class="language-mermaid"');
    expect(html).toContain("flowchart LR");
  });

  test("leaves ::: mermaid alone inside a fenced code block", () => {
    const html = render("Home.md", "```\n::: mermaid\nA --> B\n:::\n```\n").html;
    expect(html).toContain("::: mermaid");
    expect(html).not.toContain('class="language-mermaid"');
  });

  test("renders plain mermaid fences too", () => {
    expect(render("Home.md", "```mermaid\nflowchart LR\n```\n").html).toContain(
      'class="language-mermaid"',
    );
  });
});

describe("ADO links", () => {
  test("resolves root-absolute page links", () => {
    const html = render("Guide/Intro.md", "[Install](/Guide/Install)\n").html;
    expect(html).toContain('href="/?path=Guide%2FInstall.md"');
    expect(html).toContain('data-mdiv-path="Guide/Install.md"');
  });

  test("resolves extension-less relative page links", () => {
    expect(render("Guide/Intro.md", "[Next](Next)\n").html).toContain(
      'href="/?path=Guide%2FNext.md"',
    );
  });

  test("resolves root-absolute attachment links", () => {
    expect(render("Guide/Intro.md", "![D](/.attachments/diagram.png)\n").html).toContain(
      'src="/api/asset?path=.attachments%2Fdiagram.png"',
    );
  });

  test("decodes percent-encoded page names", () => {
    expect(render("Home.md", "[GS](/Getting%20Started)\n").html).toContain(
      'href="/?path=Getting%20Started.md"',
    );
    expect(render("Home.md", "[G](/%E3%82%AC%E3%82%A4%E3%83%89)\n").html).toContain(
      'data-mdiv-path="ガイド.md"',
    );
  });

  test("still handles explicit .md links and external URLs", () => {
    const html = render(
      "Guide/Intro.md",
      "[Next](Next.md#Part)\n[Ext](https://example.com)\n",
    ).html;
    expect(html).toContain('href="/?path=Guide%2FNext.md#Part"');
    expect(html).toContain('href="https://example.com"');
  });
});
