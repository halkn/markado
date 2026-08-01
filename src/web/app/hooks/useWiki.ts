import { useCallback, useEffect, useRef, useState } from "react";
import type { RenderResponse, TreeResponse } from "../../../types.ts";
import { fetchPage, fetchTree } from "@/lib/api.ts";
import { subscribeToWikiChanges } from "@/lib/sse.ts";

export type Loadable<T> =
  | { status: "loading" }
  | { status: "ready"; value: T }
  | { status: "error"; message: string };

/**
 * Tree and page are loaded independently, so navigating between pages never
 * re-renders the tree and a file change can reload just the open page.
 */
export function useWiki(pagePath: string | null): {
  tree: Loadable<TreeResponse>;
  page: Loadable<RenderResponse> | null;
} {
  const [tree, loadTree] = useLoadable<TreeResponse>(fetchTree);
  const fetchCurrentPage = useCallback(
    () => (pagePath === null ? null : fetchPage(pagePath)),
    [pagePath],
  );
  const [page, loadPage] = useLoadable<RenderResponse>(fetchCurrentPage);

  useEffect(
    () => subscribeToWikiChanges({ onTreeChanged: loadTree, onFileChanged: loadPage }),
    [loadTree, loadPage],
  );

  return { tree: tree ?? { status: "loading" }, page };
}

/**
 * Runs `request` on mount and whenever it changes, and hands back a reload
 * function. Responses that a newer request has already superseded are dropped,
 * which is what keeps a slow reload from overwriting a fresh page.
 */
function useLoadable<T>(request: () => Promise<T> | null): [Loadable<T> | null, () => void] {
  const [state, setState] = useState<Loadable<T> | null>(null);
  const latest = useRef(0);

  const run = useCallback(() => {
    const pending = request();
    if (pending === null) {
      latest.current += 1;
      setState(null);
      return;
    }

    const id = (latest.current += 1);
    setState({ status: "loading" });
    pending.then(
      (value) => {
        if (id === latest.current) {
          setState({ status: "ready", value });
        }
      },
      (error: unknown) => {
        if (id === latest.current) {
          setState({ status: "error", message: errorMessage(error) });
        }
      },
    );
  }, [request]);

  useEffect(run, [run]);

  return [state, run];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
