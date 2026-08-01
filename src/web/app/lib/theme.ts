export type Theme = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "mdiv-theme";
export const THEMES: Theme[] = ["light", "dark", "system"];

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function readStoredTheme(): Theme {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return isTheme(stored) ? stored : "system";
}

export function storeTheme(theme: Theme): void {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

export function systemTheme(): ResolvedTheme {
  return matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

export function resolveTheme(theme: Theme): ResolvedTheme {
  return theme === "system" ? systemTheme() : theme;
}

/**
 * The inline script in `index.html` sets the same attribute before first paint;
 * keeping the write here identical is what avoids a flash on reload.
 */
export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = resolveTheme(theme);
}

/** Notifies while the choice is `system`; returns an unsubscribe function. */
export function watchSystemTheme(onChange: (theme: ResolvedTheme) => void): () => void {
  const query = matchMedia(DARK_QUERY);
  const listener = (event: MediaQueryListEvent) => onChange(event.matches ? "dark" : "light");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function isTheme(value: string | null): value is Theme {
  return value !== null && (THEMES as string[]).includes(value);
}
