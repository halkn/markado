import { useEffect, useState } from "react";
import { renderMermaidHtml, type MermaidLoader } from "@/lib/mermaid.ts";

/**
 * The document HTML with its Mermaid fences turned into diagrams, falling back
 * to the server HTML until they are ready.
 *
 * Keyed on the HTML itself rather than on render count: the document is
 * re-injected whenever the page reloads, and re-rendering every diagram then
 * would flash the raw code blocks back onto the screen.
 *
 * `load` is injected by tests, which have no bundler to split the chunk.
 */
export function useMermaidHtml(html: string, load?: MermaidLoader): string {
  const [rendered, setRendered] = useState<{ source: string; html: string } | null>(null);

  useEffect(() => {
    let current = true;
    void renderMermaidHtml(html, load).then((result) => {
      if (current && result !== html) {
        setRendered({ source: html, html: result });
      }
    });
    return () => {
      current = false;
    };
  }, [html, load]);

  return rendered?.source === html ? rendered.html : html;
}
