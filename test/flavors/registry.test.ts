import { describe, expect, test } from "bun:test";
import { detectFlavorName, isFlavorSelection, resolveFlavor } from "../../src/flavors/registry.ts";
import { createWiki } from "../helpers/wiki.ts";

describe("flavor detection", () => {
  test("detects ADO from a root .order file", async () => {
    const root = createWiki({ ".order": "Home\n", "Home.md": "# Home\n" });
    expect(await detectFlavorName(root)).toBe("ado");
  });

  test("detects ADO from a root .attachments directory", async () => {
    const root = createWiki({ ".attachments/diagram.png": "png", "Home.md": "# Home\n" });
    expect(await detectFlavorName(root)).toBe("ado");
  });

  test("falls back to plain for an ordinary Markdown directory", async () => {
    const root = createWiki({ "Home.md": "# Home\n", "Guide/Intro.md": "# Intro\n" });
    expect(await detectFlavorName(root)).toBe("plain");
  });

  test("ignores markers that are not at the wiki root", async () => {
    const root = createWiki({ "Guide/.order": "Intro\n", "Guide/Intro.md": "# Intro\n" });
    expect(await detectFlavorName(root)).toBe("plain");
  });
});

describe("flavor selection", () => {
  test("an explicit selection overrides detection", async () => {
    const root = createWiki({ ".order": "Home\n", "Home.md": "# Home\n" });
    expect((await resolveFlavor(root, "plain")).name).toBe("plain");
    expect((await resolveFlavor(root, "ado")).name).toBe("ado");
    expect((await resolveFlavor(root, "auto")).name).toBe("ado");
  });

  test("validates CLI input", () => {
    expect(isFlavorSelection("auto")).toBe(true);
    expect(isFlavorSelection("ado")).toBe(true);
    expect(isFlavorSelection("plain")).toBe(true);
    expect(isFlavorSelection("github")).toBe(false);
  });
});
