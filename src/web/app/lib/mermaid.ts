export type Mermaid = {
  initialize: (config: { startOnLoad: boolean; theme: string }) => void;
  render: (id: string, source: string) => Promise<{ svg: string }>;
};

export type MermaidLoader = () => Promise<Mermaid | null>;

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

/** `load` is injected by tests, which have no bundler to split the chunk. */
export async function renderMermaidBlocks(
  container: HTMLElement,
  load: MermaidLoader = loadMermaid,
): Promise<void> {
  const blocks = [...container.querySelectorAll("code.language-mermaid")];
  if (blocks.length === 0) {
    return;
  }

  const mermaid = await load();
  if (!mermaid) {
    return;
  }

  mermaid.initialize({
    startOnLoad: false,
    theme: document.documentElement.dataset.theme === "dark" ? "dark" : "default",
  });

  for (const [index, block] of blocks.entries()) {
    const pre = block.closest("pre");
    if (!pre) {
      continue;
    }

    const figure = document.createElement("div");
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
}
