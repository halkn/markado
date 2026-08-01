import { useNavigate, useParams, useRouter, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState, type JSX, type RefObject } from "react";
import {
  Group,
  Panel,
  Separator,
  useDefaultLayout,
  usePanelRef,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { decodeReadPath } from "../../../core/readUrl.ts";
import { DocumentView } from "@/components/DocumentView.tsx";
import { FileTree } from "@/components/FileTree.tsx";
import { Outline } from "@/components/Outline.tsx";
import { TopBar } from "@/components/TopBar.tsx";
import { TooltipProvider } from "@/components/ui/tooltip.tsx";
import { useActiveHeading } from "@/hooks/useActiveHeading.ts";
import { useTheme } from "@/hooks/useTheme.ts";
import { useWiki, type Loadable } from "@/hooks/useWiki.ts";

/** Below this width the side panes are in the way rather than useful. */
const NARROW_QUERY = "(max-width: 900px)";
const PANEL_STORAGE_ID = "mdiv.panels";

export function AppShell(): JSX.Element {
  const router = useRouter();
  const navigate = useNavigate();
  const params = useParams({ strict: false });
  const hash = useRouterState({ select: (state) => state.location.hash });
  // oxlint-disable-next-line no-underscore-dangle -- the splat param is named by the router
  const pagePath = decodeReadPath(params._splat ?? "");
  const { tree, page } = useWiki(pagePath);

  const [theme, setTheme] = useTheme();
  const filesPanel = usePanelRef();
  const outlinePanel = usePanelRef();
  const [filesVisible, setFilesVisible] = useState(true);
  const [outlineVisible, setOutlineVisible] = useState(true);
  const { defaultLayout, onLayoutChanged } = useDefaultLayout({ id: PANEL_STORAGE_ID });

  const scrollRef = useRef<HTMLDivElement>(null);
  const headings = page?.status === "ready" ? page.value.headings : EMPTY_HEADINGS;
  const activeId = useActiveHeading(scrollRef, headings);

  const goToPage = useCallback(
    (nextPath: string, anchor?: string, replace = false) => {
      void navigate({ to: "/read/$", params: { _splat: nextPath }, hash: anchor, replace });
    },
    [navigate],
  );

  // `/` has no page of its own; the tree decides which one opens first.
  useEffect(() => {
    if (pagePath === null && tree.status === "ready" && tree.value.initialPagePath) {
      goToPage(tree.value.initialPagePath, undefined, true);
    }
  }, [pagePath, tree, goToPage]);

  useEffect(() => {
    const query = matchMedia(NARROW_QUERY);
    const apply = (narrow: boolean) => {
      if (narrow) {
        filesPanel.current?.collapse();
        outlinePanel.current?.collapse();
      }
    };
    apply(query.matches);
    const listener = (event: MediaQueryListEvent) => apply(event.matches);
    query.addEventListener("change", listener);
    return () => query.removeEventListener("change", listener);
    // The panel handles are refs; re-running on every render would fight the
    // reader every time they reopen a pane on a narrow window.
    // oxlint-disable-next-line exhaustive-deps
  }, []);

  useScrollToHash(scrollRef, page, hash);

  const title = page?.status === "ready" ? page.value.title : "";
  useDocumentTitle(title);

  return (
    <TooltipProvider>
      <div className="flex h-full flex-col bg-background text-foreground">
        <TopBar
          workspace={tree.status === "ready" ? tree.value.root.name : "mdiv"}
          title={title}
          theme={theme}
          onThemeChange={setTheme}
          onBack={() => router.history.back()}
          onForward={() => router.history.forward()}
          filesVisible={filesVisible}
          outlineVisible={outlineVisible}
          onToggleFiles={() => togglePanel(filesPanel.current, filesVisible)}
          onToggleOutline={() => togglePanel(outlinePanel.current, outlineVisible)}
        />

        <Group
          orientation="horizontal"
          className="min-h-0 flex-1"
          defaultLayout={defaultLayout}
          onLayoutChanged={onLayoutChanged}
        >
          <Panel
            panelRef={filesPanel}
            id="files"
            collapsible
            collapsedSize="0"
            defaultSize="20"
            minSize="12"
            onResize={(size) => setFilesVisible(size.asPercentage > 0)}
            className="overflow-auto border-r border-border bg-surface"
          >
            {tree.status === "ready" ? (
              <FileTree
                root={tree.value.root}
                currentPath={pagePath}
                onNavigate={(next) => goToPage(next)}
              />
            ) : (
              <PaneMessage state={tree} />
            )}
          </Panel>

          <ResizeHandle />

          <Panel id="document" minSize="30">
            <div ref={scrollRef} className="h-full overflow-auto">
              <main className="mx-auto w-full max-w-[72ch] px-8 py-10">
                {page?.status === "ready" ? (
                  <DocumentView
                    document={page.value}
                    onNavigate={(next, anchor) => goToPage(next, anchor)}
                  />
                ) : (
                  <PaneMessage state={page} />
                )}
              </main>
            </div>
          </Panel>

          <ResizeHandle />

          <Panel
            panelRef={outlinePanel}
            id="outline"
            collapsible
            collapsedSize="0"
            defaultSize="18"
            minSize="12"
            onResize={(size) => setOutlineVisible(size.asPercentage > 0)}
            className="overflow-auto border-l border-border bg-surface"
          >
            <Outline
              headings={headings}
              activeId={activeId}
              onSelect={(headingId) => {
                if (pagePath) {
                  goToPage(pagePath, headingId, true);
                }
              }}
            />
          </Panel>
        </Group>
      </div>
    </TooltipProvider>
  );
}

const EMPTY_HEADINGS: never[] = [];

function ResizeHandle(): JSX.Element {
  return <Separator className="w-px bg-border transition-colors hover:bg-brand active:bg-brand" />;
}

function PaneMessage({ state }: { state: Loadable<unknown> | null }): JSX.Element | null {
  if (state === null) {
    return null;
  }
  if (state.status === "loading") {
    return <p className="p-4 text-sm text-muted-foreground">読み込み中…</p>;
  }
  if (state.status === "error") {
    return <p className="p-4 text-sm text-destructive">{state.message}</p>;
  }
  return null;
}

function togglePanel(panel: PanelImperativeHandle | null, visible: boolean): void {
  if (visible) {
    panel?.collapse();
  } else {
    panel?.expand();
  }
}

/** Scrolls to `#heading` once the page that contains it has been rendered. */
function useScrollToHash(
  containerRef: RefObject<HTMLElement | null>,
  page: Loadable<unknown> | null,
  hash: string,
): void {
  const ready = page?.status === "ready";
  useEffect(() => {
    const container = containerRef.current;
    if (!ready || !container) {
      return;
    }
    if (!hash) {
      container.scrollTo({ top: 0 });
      return;
    }
    container.querySelector(`#${CSS.escape(decodeURIComponent(hash))}`)?.scrollIntoView();
  }, [ready, containerRef, hash]);
}

function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title ? `${title} - mdiv` : "mdiv";
  }, [title]);
}
