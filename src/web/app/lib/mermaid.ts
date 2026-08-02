export type MermaidConfig = {
  startOnLoad: boolean;
  securityLevel: string;
  theme: string;
};

export type Mermaid = {
  initialize: (config: MermaidConfig) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

export type MermaidLoader = () => Promise<Mermaid | null>;

/**
 * The only place Mermaid is configured. Diagrams come from whatever repository
 * the reader opened, so `securityLevel` is pinned rather than inherited from
 * whatever the installed version defaults to: `strict` runs labels through
 * Mermaid's own DOMPurify and keeps HTML labels off.
 *
 * Nothing here is taken from the document. A `%%{init: …}%%` directive inside a
 * diagram cannot reach `securityLevel` — Mermaid keeps it in the list of keys a
 * directive may not touch — so there is no path from Markdown to running code.
 */
export function mermaidConfig(): MermaidConfig {
  return {
    startOnLoad: false,
    securityLevel: "strict",
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
  };
}

let loading: Promise<Mermaid | null> | null = null;

/**
 * Bundled, but split into its own chunk and imported only for pages that
 * contain a diagram: Mermaid is by far the largest dependency, and most pages
 * never need it. Loading it from a CDN instead would trade this cost for a
 * dependency on the network being reachable, which a local reader should not
 * have.
 */
function loadMermaid(): Promise<Mermaid | null> {
  loading ??= import("mermaid")
    .then((module) => module.default as Mermaid)
    .catch((error: unknown) => {
      console.warn("mdiv: could not load Mermaid", error);
      return null;
    });
  return loading;
}

/**
 * Rewrites the document HTML instead of the DOM React has already committed.
 * Writing into that DOM loses every diagram the moment anything re-injects the
 * document — and when the re-injection lands between the query and the render,
 * the replacement happens on nodes that are no longer attached to the page, so
 * Mermaid reports success and the reader sees nothing.
 *
 * `load` is injected by tests, which have no bundler to split the chunk.
 */
export async function renderMermaidHtml(
  html: string,
  load: MermaidLoader = loadMermaid,
): Promise<string> {
  const template = document.createElement("template");
  template.innerHTML = html;

  const blocks = [...template.content.querySelectorAll("code.language-mermaid")];
  if (blocks.length === 0) {
    return html;
  }

  const mermaid = await load();
  if (!mermaid) {
    return html;
  }

  mermaid.initialize(mermaidConfig());

  for (const [index, block] of blocks.entries()) {
    const pre = block.closest("pre");
    if (!pre) {
      continue;
    }

    const figure = template.ownerDocument.createElement("div");
    figure.className = "mermaid";
    try {
      // Sequential: mermaid keeps global render state, so parallel renders of
      // several diagrams interleave and produce empty SVGs.
      // oxlint-disable-next-line no-await-in-loop
      const { svg } = await mermaid.render(
        `mdiv-mermaid-${index}-${Date.now()}`,
        block.textContent ?? "",
      );
      figure.innerHTML = svg;
    } catch (error) {
      console.warn("mdiv: Mermaid failed to render a diagram", error);
      continue;
    }
    pre.replaceWith(figure);
  }

  return template.innerHTML;
}
