import { describe, expect, mock, test } from "bun:test";
import { renderMermaidBlocks, type Mermaid } from "../../../src/web/app/lib/mermaid.ts";

function container(html: string): HTMLElement {
  const element = document.createElement("div");
  element.innerHTML = html;
  return element;
}

function fakeMermaid(): Mermaid & { calls: string[] } {
  const calls: string[] = [];
  return {
    calls,
    initialize: mock(),
    render: (_id, source) => {
      calls.push(source);
      return Promise.resolve({ svg: `<svg data-source="${source.trim()}"></svg>` });
    },
  };
}

const page = `
<h1>Diagrams</h1>
<pre><code class="language-mermaid">graph TD
  A --&gt; B</code></pre>
<pre><code class="language-typescript">const a = 1;</code></pre>
<pre><code class="language-mermaid">sequenceDiagram
  A-&gt;&gt;B: hi</code></pre>
`;

describe("renderMermaidBlocks", () => {
  test("replaces every mermaid block with its rendered diagram", async () => {
    const element = container(page);
    const mermaid = fakeMermaid();

    await renderMermaidBlocks(element, () => Promise.resolve(mermaid));

    expect(element.querySelectorAll("div.mermaid")).toHaveLength(2);
    expect(element.querySelectorAll("code.language-mermaid")).toHaveLength(0);
    // The other fence is untouched.
    expect(element.querySelectorAll("code.language-typescript")).toHaveLength(1);
  });

  test("passes the decoded source, not the escaped HTML", async () => {
    const mermaid = fakeMermaid();

    await renderMermaidBlocks(container(page), () => Promise.resolve(mermaid));

    expect(mermaid.calls[0]).toBe("graph TD\n  A --> B");
    expect(mermaid.calls[1]).toContain("A->>B: hi");
  });

  test("leaves the code block in place when Mermaid is unavailable", async () => {
    const element = container(page);

    await renderMermaidBlocks(element, () => Promise.resolve(null));

    expect(element.querySelectorAll("code.language-mermaid")).toHaveLength(2);
  });

  test("keeps going when one diagram fails to render", async () => {
    const element = container(page);
    let first = true;
    const mermaid: Mermaid = {
      initialize: mock(),
      render: (_id, source) => {
        if (first) {
          first = false;
          return Promise.reject(new Error("bad diagram"));
        }
        return Promise.resolve({ svg: `<svg data-source="${source.trim()}"></svg>` });
      },
    };

    await renderMermaidBlocks(element, () => Promise.resolve(mermaid));

    expect(element.querySelectorAll("div.mermaid")).toHaveLength(1);
    expect(element.querySelectorAll("code.language-mermaid")).toHaveLength(1);
  });

  test("does not load Mermaid for a page without diagrams", async () => {
    const load = mock(() => Promise.resolve(fakeMermaid()));

    await renderMermaidBlocks(container("<p>no diagrams</p>"), load);

    expect(load).not.toHaveBeenCalled();
  });
});
