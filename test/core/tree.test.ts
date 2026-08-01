import { describe, expect, test } from "bun:test";
import { mkdirSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { scanWiki } from "../../src/core/tree.ts";
import { plainFlavor } from "../../src/flavors/plain.ts";
import { createWiki, nodeNames, wikiContext } from "../helpers/wiki.ts";

describe("plain tree scanning", () => {
  test("orders by name and ignores .order", async () => {
    const root = createWiki({
      ".order": "Zed\nAlpha\n",
      "Alpha.md": "# Alpha\n",
      "Zed.md": "# Zed\n",
    });

    const tree = await scanWiki(wikiContext(root, plainFlavor));
    expect(nodeNames(tree.root.children)).toEqual(["Alpha", "Zed"]);
  });

  test("keeps a page file and its same-named folder as separate nodes", async () => {
    const root = createWiki({
      "Guide.md": "# Guide\n",
      "Guide/Install.md": "# Install\n",
    });

    const tree = await scanWiki(wikiContext(root, plainFlavor));
    expect(tree.root.children).toHaveLength(2);
    expect(tree.root.children.map((node) => node.kind).toSorted()).toEqual(["dir", "file"]);
    expect(tree.files.toSorted()).toEqual(["Guide.md", "Guide/Install.md"]);
  });

  test("hides dot-prefixed entries and non-Markdown files", async () => {
    const root = createWiki({
      "Home.md": "# Home\n",
      "notes.txt": "text",
      ".hidden/Secret.md": "# Secret\n",
      ".attachments/diagram.png": "png",
    });

    const tree = await scanWiki(wikiContext(root, plainFlavor));
    expect(nodeNames(tree.root.children)).toEqual(["Home"]);
    expect(tree.files).toEqual(["Home.md"]);
  });

  test("reports the resolved flavor and picks the first file as the initial page", async () => {
    const root = createWiki({ "Alpha.md": "# Alpha\n", "Beta.md": "# Beta\n" });
    const tree = await scanWiki(wikiContext(root, plainFlavor));
    expect(tree.flavor).toBe("plain");
    expect(tree.initialPagePath).toBe("Alpha.md");
  });

  test("terminates when a symlink points back into an ancestor", async () => {
    const root = createWiki({ "Guide/Intro.md": "# Intro\n" });
    symlinkSync(root, join(root, "Guide", "loop"));

    const tree = await scanWiki(wikiContext(root, plainFlavor));
    expect(tree.files).toContain("Guide/Intro.md");
  });

  test("leaves dependency directories out of the tree", async () => {
    const root = createWiki({
      "Home.md": "# Home\n",
      "node_modules/react/README.md": "# react\n",
    });

    const tree = await scanWiki(wikiContext(root, plainFlavor));
    expect(tree.files).toEqual(["Home.md"]);
  });

  test("stops descending past the depth limit instead of recursing forever", async () => {
    const root = createWiki({});
    const deep = Array.from({ length: 40 }, (_, index) => `d${index}`).join("/");
    mkdirSync(join(root, deep), { recursive: true });

    const tree = await scanWiki(wikiContext(root, plainFlavor));
    expect(depthOf(tree.root)).toBeLessThan(41);
  });
});

function depthOf(node: { children: { children: unknown[] }[] }): number {
  const children = node.children as { children: unknown[] }[];
  if (children.length === 0) {
    return 1;
  }
  return 1 + Math.max(...children.map((child) => depthOf(child as never)));
}
