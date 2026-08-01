import { describe, expect, mock, test } from "bun:test";
import { renderMermaidHtml, type Mermaid } from "../../../src/web/app/lib/mermaid.ts";

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

function count(html: string, selector: string): number {
  const template = document.createElement("template");
  template.innerHTML = html;
  return template.content.querySelectorAll(selector).length;
}

const page = `
<h1>Diagrams</h1>
<pre><code class="language-mermaid">graph TD
  A --&gt; B</code></pre>
<pre><code class="language-typescript">const a = 1;</code></pre>
<pre><code class="language-mermaid">sequenceDiagram
  A-&gt;&gt;B: hi</code></pre>
`;

describe("renderMermaidHtml", () => {
  test("replaces every mermaid block with its rendered diagram", async () => {
    const html = await renderMermaidHtml(page, () => Promise.resolve(fakeMermaid()));

    expect(count(html, "div.mermaid")).toBe(2);
    expect(count(html, "code.language-mermaid")).toBe(0);
    // The other fence is untouched.
    expect(count(html, "code.language-typescript")).toBe(1);
  });

  // The bug this guards: the diagrams used to be written into the DOM React had
  // already committed, so anything that re-injected the document threw them
  // away — and a document re-injected between the query and the render left the
  // replacement happening on nodes that were no longer attached to anything.
  test("leaves the HTML it was given untouched", async () => {
    const html = await renderMermaidHtml(page, () => Promise.resolve(fakeMermaid()));

    expect(page).toContain('code class="language-mermaid"');
    expect(html).not.toBe(page);
  });

  test("passes the decoded source, not the escaped HTML", async () => {
    const mermaid = fakeMermaid();

    await renderMermaidHtml(page, () => Promise.resolve(mermaid));

    expect(mermaid.calls[0]).toBe("graph TD\n  A --> B");
    expect(mermaid.calls[1]).toContain("A->>B: hi");
  });

  test("returns the original HTML when Mermaid is unavailable", async () => {
    const html = await renderMermaidHtml(page, () => Promise.resolve(null));

    expect(html).toBe(page);
  });

  test("keeps going when one diagram fails to render", async () => {
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

    const html = await renderMermaidHtml(page, () => Promise.resolve(mermaid));

    expect(count(html, "div.mermaid")).toBe(1);
    expect(count(html, "code.language-mermaid")).toBe(1);
  });

  test("does not load Mermaid for a page without diagrams", async () => {
    const load = mock(() => Promise.resolve(fakeMermaid()));

    const html = await renderMermaidHtml("<p>no diagrams</p>", load);

    expect(html).toBe("<p>no diagrams</p>");
    expect(load).not.toHaveBeenCalled();
  });
});
