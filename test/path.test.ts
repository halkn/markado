import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertSafeRelativePath, resolveMarkdownRelativePath } from "../src/path.ts";

describe("path safety", () => {
  test("accepts root-relative paths under the wiki root", async () => {
    const root = mkdtempSync(join(tmpdir(), "markado-path-"));
    mkdirSync(join(root, "Guide"));
    writeFileSync(join(root, "Guide", "Intro.md"), "# Intro\n");
    await expect(assertSafeRelativePath(root, "Guide/Intro.md")).resolves.toBe(
      join(root, "Guide/Intro.md"),
    );
  });

  test("rejects absolute paths and traversal", async () => {
    const root = mkdtempSync(join(tmpdir(), "markado-path-"));
    await expect(assertSafeRelativePath(root, "/etc/passwd")).rejects.toThrow();
    await expect(assertSafeRelativePath(root, "../secret.md")).rejects.toThrow();
    await expect(assertSafeRelativePath(root, "Guide/../../secret.md")).rejects.toThrow();
  });

  test("rejects symlink escapes outside the wiki root", async () => {
    const root = mkdtempSync(join(tmpdir(), "markado-root-"));
    const outside = mkdtempSync(join(tmpdir(), "markado-outside-"));
    writeFileSync(join(outside, "secret.md"), "# Secret\n");
    symlinkSync(outside, join(root, "linked"));

    await expect(assertSafeRelativePath(root, "linked/secret.md")).rejects.toThrow(
      "Path escapes the wiki root",
    );
  });

  test("resolves Markdown-relative references from the current page directory", () => {
    expect(resolveMarkdownRelativePath("Guide/Intro.md", "../assets/logo.png")).toBe(
      "assets/logo.png",
    );
  });
});
