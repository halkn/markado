import { beforeEach, describe, expect, test } from "bun:test";
import {
  applyTheme,
  readStoredTheme,
  resolveTheme,
  storeTheme,
  THEME_STORAGE_KEY,
} from "../../../src/web/app/lib/theme.ts";

beforeEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe("theme", () => {
  test("falls back to system when nothing valid is stored", () => {
    expect(readStoredTheme()).toBe("system");
    localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    expect(readStoredTheme()).toBe("system");
  });

  test("round-trips the stored choice", () => {
    storeTheme("dark");
    expect(readStoredTheme()).toBe("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  test("resolves an explicit choice without consulting the system", () => {
    expect(resolveTheme("light")).toBe("light");
    expect(resolveTheme("dark")).toBe("dark");
  });

  test("writes the resolved theme to the document element", () => {
    applyTheme("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    applyTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  test("resolves system to one of the two concrete themes", () => {
    expect(["light", "dark"]).toContain(resolveTheme("system"));
  });
});
