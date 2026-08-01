import { Monitor, Moon, Sun } from "lucide-react";
import type { JSX } from "react";
import { Button } from "@/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import { resolveTheme, type Theme } from "@/lib/theme.ts";

const LABELS: Record<Theme, string> = {
  light: "ライト",
  dark: "ダーク",
  system: "システム",
};

export type ThemeMenuProps = {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
};

export function ThemeMenu({ theme, onThemeChange }: ThemeMenuProps): JSX.Element {
  const Icon = theme === "system" ? Monitor : resolveTheme(theme) === "dark" ? Moon : Sun;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={`テーマ: ${LABELS[theme]}`}>
          <Icon aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={theme}
          onValueChange={(value) => onThemeChange(value as Theme)}
        >
          {(Object.keys(LABELS) as Theme[]).map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {LABELS[option]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
