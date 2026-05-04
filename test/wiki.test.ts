import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { scanWiki } from "../src/wiki.ts";
import type { WikiContext } from "../src/types.ts";

describe("wiki tree scanning", () => {
  test("applies .order, hides hidden directories, and merges page folders", () => {
    const root = mkdtempSync(join(tmpdir(), "markado-wiki-"));
    writeFileSync(join(root, ".order"), "Guide\nHome.md\n");
    writeFileSync(join(root, "Home.md"), "# Home\n");
    writeFileSync(join(root, "Guide.md"), "# Guide\n");
    writeFileSync(join(root, "Zed.md"), "# Zed\n");
    mkdirSync(join(root, "Guide"));
    writeFileSync(join(root, "Guide", ".order"), "Reference\nInstall\n");
    writeFileSync(join(root, "Guide", "Install.md"), "# Install\n");
    writeFileSync(join(root, "Guide", "Reference.md"), "# Reference\n");
    mkdirSync(join(root, ".hidden"));
    writeFileSync(join(root, ".hidden", "Secret.md"), "# Secret\n");
    mkdirSync(join(root, ".attachments"));
    writeFileSync(join(root, ".attachments", "diagram.png"), "png");

    const tree = scanWiki({
      rootDir: root,
      initialPagePath: null,
      mode: "tree",
    } satisfies WikiContext);

    expect(tree.files).toEqual([
      "Guide.md",
      "Guide/Reference.md",
      "Guide/Install.md",
      "Home.md",
      "Zed.md",
    ]);
    expect(tree.root.children.map((node) => node.name)).toEqual(["Guide", "Home", "Zed"]);
    expect(tree.root.children[0]).toMatchObject({
      name: "Guide",
      path: "Guide.md",
      kind: "file",
    });
    expect(tree.root.children[0]?.children.map((node) => node.name)).toEqual([
      "Reference",
      "Install",
    ]);
  });
});
