import { describe, expect, test } from "bun:test";
import { linkDataAttributes, resolveLinkTarget, toHref } from "../../src/core/links.ts";

describe("link resolution", () => {
  test("resolves sibling Markdown references to pages", () => {
    expect(resolveLinkTarget("Guide/Intro.md", "Next.md#Part")).toEqual({
      kind: "page",
      path: "Guide/Next.md",
      anchor: "Part",
    });
  });

  test("resolves non-Markdown references to assets", () => {
    expect(resolveLinkTarget("Guide/Intro.md", "../.attachments/diagram.png")).toEqual({
      kind: "asset",
      path: ".attachments/diagram.png",
    });
  });

  test("treats images as assets even when they point at Markdown", () => {
    expect(resolveLinkTarget("Home.md", "Next.md", { forceAsset: true })).toEqual({
      kind: "asset",
      path: "Next.md",
    });
  });

  test("keeps in-page anchors and external URLs untouched", () => {
    expect(resolveLinkTarget("Home.md", "#section")).toEqual({ kind: "anchor", id: "section" });
    expect(resolveLinkTarget("Home.md", "https://example.com")).toEqual({
      kind: "external",
      href: "https://example.com",
    });
    expect(resolveLinkTarget("Home.md", "//example.com")).toEqual({
      kind: "external",
      href: "//example.com",
    });
  });

  test("refuses to resolve references that climb out of the wiki root", () => {
    expect(resolveLinkTarget("Home.md", "../outside.md")).toEqual({
      kind: "external",
      href: "../outside.md",
    });
  });

  test("decodes percent-encoded page names but leaves encoded separators alone", () => {
    expect(resolveLinkTarget("Home.md", "Getting%20Started.md")).toEqual({
      kind: "page",
      path: "Getting Started.md",
    });
    expect(resolveLinkTarget("Home.md", "%E3%82%AC%E3%82%A4%E3%83%89.md")).toEqual({
      kind: "page",
      path: "ガイド.md",
    });
    // %2F stays literal so it cannot smuggle a traversal past resolveSafePath.
    expect(resolveLinkTarget("Home.md", "a%2F..%2F..%2Fsecret.md")).toEqual({
      kind: "page",
      path: "a%2F..%2F..%2Fsecret.md",
    });
  });

  test("renders hrefs only at the boundary", () => {
    expect(toHref({ kind: "page", path: "Guide/Next.md", anchor: "Part" })).toBe(
      "/?path=Guide%2FNext.md#Part",
    );
    expect(toHref({ kind: "asset", path: ".attachments/diagram.png" })).toBe(
      "/api/asset?path=.attachments%2Fdiagram.png",
    );
    expect(toHref({ kind: "anchor", id: "section" })).toBe("#section");
    expect(toHref({ kind: "external", href: "https://example.com" })).toBe("https://example.com");
  });

  test("exposes page targets to the frontend as data attributes", () => {
    expect(linkDataAttributes({ kind: "page", path: "Guide/Next.md", anchor: "Part" })).toEqual({
      "data-mdiv-kind": "page",
      "data-mdiv-path": "Guide/Next.md",
      "data-mdiv-anchor": "Part",
    });
    expect(linkDataAttributes({ kind: "external", href: "https://example.com" })).toEqual({});
  });
});
