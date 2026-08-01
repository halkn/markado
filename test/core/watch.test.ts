import { describe, expect, test } from "bun:test";
import { classifyChange, shouldIgnore, toWatchRelativePath } from "../../src/core/watch.ts";

describe("watch path filtering", () => {
  test("keeps ordinary wiki paths", () => {
    expect(shouldIgnore("Home.md")).toBe(false);
    expect(shouldIgnore("Guide/Install.md")).toBe(false);
  });

  test("keeps the dot entries the wiki relies on", () => {
    expect(shouldIgnore(".order")).toBe(false);
    expect(shouldIgnore("Guide/.order")).toBe(false);
    expect(shouldIgnore(".attachments/diagram.png")).toBe(false);
  });

  test("ignores other dot-prefixed segments", () => {
    expect(shouldIgnore(".git/HEAD")).toBe(true);
    expect(shouldIgnore("Guide/.cache/x")).toBe(true);
  });

  test("keeps the root itself", () => {
    expect(shouldIgnore("")).toBe(false);
  });
});

describe("watch base resolution", () => {
  // macOS reports a wiki under /tmp as /private/tmp. With a single base the
  // relative path would start with `..`, which the dot-segment rule would
  // silently treat as a hidden file and drop every event.
  test("accepts a path reported through the resolved root", () => {
    const bases = ["/tmp/wiki", "/private/tmp/wiki"];
    expect(toWatchRelativePath(bases, "/private/tmp/wiki/Home.md")).toBe("Home.md");
    expect(shouldIgnore(toWatchRelativePath(bases, "/private/tmp/wiki/Home.md"))).toBe(false);
  });

  test("accepts a path reported through the original root", () => {
    const bases = ["/tmp/wiki", "/private/tmp/wiki"];
    expect(toWatchRelativePath(bases, "/tmp/wiki/Guide/Install.md")).toBe("Guide/Install.md");
  });

  test("reports rather than drops a path under an unknown base", () => {
    expect(toWatchRelativePath(["/tmp/wiki"], "/elsewhere/Home.md")).toBe("");
    expect(shouldIgnore(toWatchRelativePath(["/tmp/wiki"], "/elsewhere/Home.md"))).toBe(false);
  });
});

describe("change classification", () => {
  test("a new Markdown page changes the tree, other new files do not", () => {
    expect(classifyChange("add", "Guide.md")).toBe("tree_changed");
    expect(classifyChange("add", ".attachments/diagram.png")).toBe("file_changed");
  });

  test("editing .order changes the tree, editing a page does not", () => {
    expect(classifyChange("change", ".order")).toBe("tree_changed");
    expect(classifyChange("change", "Home.md")).toBe("file_changed");
  });

  test("removals and directory changes always change the tree", () => {
    expect(classifyChange("unlink", "Home.md")).toBe("tree_changed");
    expect(classifyChange("addDir", "Guide")).toBe("tree_changed");
    expect(classifyChange("unlinkDir", "Guide")).toBe("tree_changed");
  });

  test("ignores events mdiv does not act on", () => {
    expect(classifyChange("ready", "")).toBeNull();
    expect(classifyChange("error", "")).toBeNull();
  });
});
