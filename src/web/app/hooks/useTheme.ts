import { useCallback, useEffect, useState } from "react";
import {
  applyTheme,
  readStoredTheme,
  storeTheme,
  watchSystemTheme,
  type Theme,
} from "@/lib/theme.ts";

export function useTheme(): [Theme, (theme: Theme) => void] {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    applyTheme(theme);
    return theme === "system" ? watchSystemTheme(() => applyTheme("system")) : undefined;
  }, [theme]);

  const setTheme = useCallback((next: Theme) => {
    storeTheme(next);
    setThemeState(next);
  }, []);

  return [theme, setTheme];
}
