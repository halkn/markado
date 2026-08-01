import { describe, expect, mock, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useMermaidHtml } from "../../../src/web/app/hooks/useMermaidHtml.ts";
import type { Mermaid } from "../../../src/web/app/lib/mermaid.ts";

const page = '<pre><code class="language-mermaid">graph TD</code></pre>';

function fakeLoad(): () => Promise<Mermaid> {
  const mermaid: Mermaid = {
    initialize: mock(),
    render: (_id, source) => Promise.resolve({ svg: `<svg data-source="${source}"></svg>` }),
  };
  return mock(() => Promise.resolve(mermaid));
}

describe("useMermaidHtml", () => {
  test("hands back the server HTML until the diagrams are ready", async () => {
    const { result } = renderHook(() => useMermaidHtml(page, fakeLoad()));

    expect(result.current).toBe(page);
    await waitFor(() => expect(result.current).toContain('div class="mermaid"'));
  });

  // The bug this guards: the document is re-injected repeatedly, and rendering
  // again each time would flash the raw code block back onto the screen.
  test("keeps the rendered HTML when the same document arrives again", async () => {
    const load = fakeLoad();
    const { result, rerender } = renderHook(({ html }) => useMermaidHtml(html, load), {
      initialProps: { html: page },
    });
    await waitFor(() => expect(result.current).toContain('div class="mermaid"'));
    const rendered = result.current;

    await act(async () => {
      rerender({ html: page });
    });

    expect(result.current).toBe(rendered);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("renders the diagrams of a page it is given next", async () => {
    const load = fakeLoad();
    const { result, rerender } = renderHook(({ html }) => useMermaidHtml(html, load), {
      initialProps: { html: page },
    });
    await waitFor(() => expect(result.current).toContain('div class="mermaid"'));

    const next = '<pre><code class="language-mermaid">pie</code></pre>';
    await act(async () => {
      rerender({ html: next });
    });

    await waitFor(() => expect(result.current).toContain('data-source="pie"'));
  });
});
