import { type JSX, type MouseEvent } from "react";
import type { RenderResponse } from "../../../types.ts";
import { useMermaidHtml } from "@/hooks/useMermaidHtml.ts";

export type DocumentViewProps = {
  document: RenderResponse;
  onNavigate: (pagePath: string, anchor?: string) => void;
};

/**
 * React owns the shell; the Markdown HTML comes from the server. Internal links
 * carry `data-mdiv-*`, so navigation is intercepted without re-parsing hrefs.
 */
export function DocumentView({ document, onNavigate }: DocumentViewProps): JSX.Element {
  const html = useMermaidHtml(document.html);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    if (event.defaultPrevented || event.button !== 0) {
      return;
    }
    // Let the browser handle "open in a new tab" and friends.
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const link = (event.target as Element).closest<HTMLAnchorElement>('a[data-mdiv-kind="page"]');
    if (!link) {
      return;
    }

    event.preventDefault();
    onNavigate(link.dataset.mdivPath ?? "", link.dataset.mdivAnchor);
  };

  return (
    // The handler only ever intercepts clicks on anchors, which already answer
    // to the keyboard; the article itself is not interactive.
    // oxlint-disable-next-line click-events-have-key-events, no-noninteractive-element-interactions
    <article
      className="markdown-body"
      onClick={onClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
