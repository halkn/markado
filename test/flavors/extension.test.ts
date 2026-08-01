import { describe, expect, test } from "bun:test";
import type MarkdownIt from "markdown-it";
import { renderMarkdown } from "../../src/core/markdown.ts";
import { scanWiki } from "../../src/core/tree.ts";
import { plainFlavor } from "../../src/flavors/plain.ts";
import type { Flavor } from "../../src/flavors/types.ts";
import { createWiki, nodeNames, wikiContext } from "../helpers/wiki.ts";

/**
 * Guards the seams a future flavor needs (footnotes, GitHub Alerts, custom
 * ordering) without pulling those features forward. A hand-rolled plugin keeps
 * the check dependency free.
 */
function shoutPlugin(md: MarkdownIt): void {
  md.core.ruler.push("test_shout", (state) => {
    for (const token of state.tokens) {
      for (const child of token.children ?? []) {
        if (child.type === "text") {
          child.content = child.content.toUpperCase();
        }
      }
    }
  });
}

describe("flavor extension points", () => {
  test("markdownItPlugins reach the renderer", () => {
    const flavor: Flavor = { name: "plain", markdownItPlugins: [shoutPlugin] };
    expect(renderMarkdown(flavor, "Home.md", "hello\n").html).toContain("HELLO");
  });

  test("plugins stay scoped to their flavor", () => {
    expect(renderMarkdown(plainFlavor, "Home.md", "hello\n").html).toContain("hello");
  });

  test("resolveLink can override the core resolution, and null falls back", () => {
    const flavor: Flavor = {
      name: "plain",
      resolveLink: (_from, href) => (href === "special" ? { kind: "anchor", id: "moved" } : null),
    };
    const html = renderMarkdown(flavor, "Home.md", "[a](special)\n[b](Other.md)\n").html;
    expect(html).toContain('href="#moved"');
    expect(html).toContain('href="/read/Other.md"');
  });

  test("excludeFromTree hides entries the core would otherwise show", async () => {
    const flavor: Flavor = {
      name: "plain",
      excludeFromTree: (entry) => entry.name === "Draft.md",
    };
    const root = createWiki({ "Home.md": "# Home\n", "Draft.md": "# Draft\n" });

    const tree = await scanWiki(wikiContext(root, flavor));
    expect(nodeNames(tree.root.children)).toEqual(["Home"]);
  });

  test("createComparator controls sibling ordering, and null falls back to name order", async () => {
    const root = createWiki({ "Alpha.md": "# Alpha\n", "Zed.md": "# Zed\n" });

    const reversed: Flavor = {
      name: "plain",
      createComparator: async () => (left, right) => right.name.localeCompare(left.name),
    };
    const unset: Flavor = { name: "plain", createComparator: async () => null };

    expect(nodeNames((await scanWiki(wikiContext(root, reversed))).root.children)).toEqual([
      "Zed",
      "Alpha",
    ]);
    expect(nodeNames((await scanWiki(wikiContext(root, unset))).root.children)).toEqual([
      "Alpha",
      "Zed",
    ]);
  });

  test("groupEntries controls how siblings become nodes", async () => {
    const flavor: Flavor = {
      name: "plain",
      groupEntries: (entries) =>
        entries
          .filter((entry) => entry.kind === "file")
          .map((entry) => ({ name: entry.name, file: entry, dir: null })),
    };
    const root = createWiki({ "Home.md": "# Home\n" });

    const tree = await scanWiki(wikiContext(root, flavor));
    expect(nodeNames(tree.root.children)).toEqual(["Home.md"]);
  });
});
