import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  assertSafeRelativePath,
  PathSafetyError,
  resolveMarkdownRelativePath,
  resolveSafePath,
} from "../../src/core/path.ts";
import { createWiki } from "../helpers/wiki.ts";

describe("path safety", () => {
  test("accepts root-relative paths under the wiki root", async () => {
    const root = createWiki({ "Guide/Intro.md": "# Intro\n" });
    await expect(assertSafeRelativePath(root, "Guide/Intro.md")).resolves.toBe(
      join(root, "Guide/Intro.md"),
    );
  });

  test("accepts non-ASCII and space-containing page names", async () => {
    const root = createWiki({
      "ガイド/はじめに.md": "# はじめに\n",
      "Getting Started.md": "# GS\n",
    });
    await expect(assertSafeRelativePath(root, "ガイド/はじめに.md")).resolves.toBe(
      join(root, "ガイド/はじめに.md"),
    );
    await expect(assertSafeRelativePath(root, "Getting Started.md")).resolves.toBe(
      join(root, "Getting Started.md"),
    );
  });

  test("rejects absolute paths and traversal", async () => {
    const root = createWiki({});
    await expect(assertSafeRelativePath(root, "/etc/passwd")).rejects.toThrow(PathSafetyError);
    await expect(assertSafeRelativePath(root, "../secret.md")).rejects.toThrow(PathSafetyError);
    await expect(assertSafeRelativePath(root, "Guide/../../secret.md")).rejects.toThrow(
      PathSafetyError,
    );
  });

  test("rejects symlink escapes outside the wiki root", async () => {
    const root = mkdtempSync(join(tmpdir(), "mdiv-root-"));
    const outside = mkdtempSync(join(tmpdir(), "mdiv-outside-"));
    writeFileSync(join(outside, "secret.md"), "# Secret\n");
    symlinkSync(outside, join(root, "linked"));

    await expect(assertSafeRelativePath(root, "linked/secret.md")).rejects.toThrow(
      "Path escapes the wiki root",
    );
  });

  test("resolveSafePath accepts paths that do not exist yet", () => {
    const root = createWiki({});
    expect(resolveSafePath(root, "Missing.md")).toBe(join(root, "Missing.md"));
  });

  test("assertSafeRelativePath tolerates missing files under a real root", async () => {
    const root = createWiki({ "Guide/": "" });
    mkdirSync(join(root, "Guide"), { recursive: true });
    await expect(assertSafeRelativePath(root, "Guide/Missing.md")).resolves.toBe(
      join(root, "Guide/Missing.md"),
    );
  });

  test("resolves Markdown-relative references from the current page directory", () => {
    expect(resolveMarkdownRelativePath("Guide/Intro.md", "../assets/logo.png")).toBe(
      "assets/logo.png",
    );
    expect(resolveMarkdownRelativePath("Home.md", "./Next.md")).toBe("Next.md");
  });
});
