import { describe, expect, test } from "bun:test";
import { pagePathFromReadUrl, toReadUrl } from "../../src/core/readUrl.ts";

describe("toReadUrl", () => {
  test("keeps directory separators readable and encodes the segments", () => {
    expect(toReadUrl("docs/architecture.md")).toBe("/read/docs/architecture.md");
    expect(toReadUrl("docs/設計 メモ.md")).toBe(`/read/docs/${encodeURIComponent("設計 メモ.md")}`);
  });

  test("encodes characters that would otherwise change the URL structure", () => {
    expect(toReadUrl("a#b.md")).toBe("/read/a%23b.md");
    expect(toReadUrl("a?b.md")).toBe("/read/a%3Fb.md");
    expect(toReadUrl("100%.md")).toBe("/read/100%25.md");
  });

  test("appends the anchor", () => {
    expect(toReadUrl("docs/a.md", "data-flow")).toBe("/read/docs/a.md#data-flow");
    expect(toReadUrl("docs/a.md", "見出し")).toBe(
      `/read/docs/a.md#${encodeURIComponent("見出し")}`,
    );
  });
});

describe("pagePathFromReadUrl", () => {
  test("round-trips every path toReadUrl produces", () => {
    for (const pagePath of ["Home.md", "docs/設計 メモ.md", "a#b.md", "100%.md"]) {
      expect(pagePathFromReadUrl(toReadUrl(pagePath))).toBe(pagePath);
    }
  });

  test("ignores the anchor", () => {
    expect(pagePathFromReadUrl("/read/docs/a.md#x")).toBe("docs/a.md");
  });

  test("returns null for anything outside the read scheme", () => {
    expect(pagePathFromReadUrl("/")).toBeNull();
    expect(pagePathFromReadUrl("/api/tree")).toBeNull();
    expect(pagePathFromReadUrl("/read/")).toBeNull();
  });
});
