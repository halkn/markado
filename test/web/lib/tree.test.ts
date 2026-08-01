import { describe, expect, test } from "bun:test";
import type { TreeNode } from "../../../src/types.ts";
import { childKey, expandedKeysFor } from "../../../src/web/app/lib/tree.ts";

function dir(name: string, children: TreeNode[]): TreeNode {
  return { name, path: null, kind: "dir", children };
}

function file(name: string, path: string, children: TreeNode[] = []): TreeNode {
  return { name, path, kind: "file", children };
}

const root = dir("wiki", [
  file("Home", "Home.md"),
  dir("docs", [
    file("architecture", "docs/architecture.md"),
    dir("design", [file("api", "docs/design/api.md")]),
  ]),
  // An Azure DevOps Wiki page folder: a file node that also has children.
  file("Guide", "Guide.md", [file("Install", "Guide/Install.md")]),
]);

describe("childKey", () => {
  test("derives a stable key from the path when the node has one", () => {
    expect(childKey("", file("Home", "Home.md"))).toBe("Home.md");
  });

  test("falls back to the parent key and the name for directories", () => {
    expect(childKey("", dir("docs", []))).toBe("docs");
    expect(childKey("docs", dir("design", []))).toBe("docs/design");
  });
});

describe("expandedKeysFor", () => {
  test("expands every ancestor of the current page", () => {
    expect(expandedKeysFor(root, "docs/design/api.md")).toEqual(new Set(["docs", "docs/design"]));
  });

  test("expands the page folder that contains the current page", () => {
    expect(expandedKeysFor(root, "Guide/Install.md")).toEqual(new Set(["Guide.md"]));
  });

  test("expands nothing for a top level page or an unknown path", () => {
    expect(expandedKeysFor(root, "Home.md")).toEqual(new Set());
    expect(expandedKeysFor(root, "missing.md")).toEqual(new Set());
    expect(expandedKeysFor(root, null)).toEqual(new Set());
  });
});
