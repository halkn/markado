import { describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSafeRelativePath, resolveMarkdownRelativePath } from "../src/path.ts";

describe("path safety", () => {
  test("accepts root-relative paths under the wiki root", () => {
    const root = mkdtempSync(join(tmpdir(), "markado-path-"));
    expect(assertSafeRelativePath(root, "Guide/Intro.md")).toBe(join(root, "Guide/Intro.md"));
  });

  test("rejects absolute paths and traversal", () => {
    const root = mkdtempSync(join(tmpdir(), "markado-path-"));
    expect(() => assertSafeRelativePath(root, "/etc/passwd")).toThrow();
    expect(() => assertSafeRelativePath(root, "../secret.md")).toThrow();
    expect(() => assertSafeRelativePath(root, "Guide/../../secret.md")).toThrow();
  });

  test("resolves Markdown-relative references from the current page directory", () => {
    expect(resolveMarkdownRelativePath("Guide/Intro.md", "../assets/logo.png")).toBe(
      "assets/logo.png",
    );
  });
});
