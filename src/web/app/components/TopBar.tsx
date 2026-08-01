import { ChevronLeft, ChevronRight, PanelLeft, PanelRight } from "lucide-react";
import type { JSX, ReactNode } from "react";
import { ThemeMenu } from "@/components/ThemeMenu.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip.tsx";
import type { Theme } from "@/lib/theme.ts";

export type TopBarProps = {
  workspace: string;
  title: string;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onBack: () => void;
  onForward: () => void;
  filesVisible: boolean;
  outlineVisible: boolean;
  onToggleFiles: () => void;
  onToggleOutline: () => void;
};

export function TopBar(props: TopBarProps): JSX.Element {
  return (
    <header className="flex h-11 shrink-0 items-center gap-1 border-b border-border px-2">
      <IconButton label="戻る" onClick={props.onBack}>
        <ChevronLeft aria-hidden />
      </IconButton>
      <IconButton label="進む" onClick={props.onForward}>
        <ChevronRight aria-hidden />
      </IconButton>

      <IconButton
        label={props.filesVisible ? "ファイルペインを閉じる" : "ファイルペインを開く"}
        pressed={props.filesVisible}
        onClick={props.onToggleFiles}
      >
        <PanelLeft aria-hidden />
      </IconButton>

      <div className="mx-2 flex min-w-0 flex-1 items-baseline gap-2">
        <span className="shrink-0 text-sm font-medium">{props.workspace}</span>
        <span className="truncate text-xs text-muted-foreground">{props.title}</span>
      </div>

      <IconButton
        label={props.outlineVisible ? "アウトラインを閉じる" : "アウトラインを開く"}
        pressed={props.outlineVisible}
        onClick={props.onToggleOutline}
      >
        <PanelRight aria-hidden />
      </IconButton>
      <ThemeMenu theme={props.theme} onThemeChange={props.onThemeChange} />
    </header>
  );
}

function IconButton({
  label,
  pressed,
  onClick,
  children,
}: {
  label: string;
  pressed?: boolean;
  onClick: () => void;
  children: ReactNode;
}): JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          aria-pressed={pressed}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
