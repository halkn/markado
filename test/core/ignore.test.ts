import { describe, expect, test } from "bun:test";
import { isIgnoredSegment } from "../../src/core/ignore.ts";

describe("isIgnoredSegment", () => {
  test("skips dependency and build directories", () => {
    expect(isIgnoredSegment("node_modules")).toBe(true);
  });

  test("keeps ordinary wiki entries", () => {
    for (const name of ["docs", "Home.md", "node_modules_notes", "my-node_modules"]) {
      expect(isIgnoredSegment(name)).toBe(false);
    }
  });
});
