export const INDEX_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>mdiv</title>
    <link rel="stylesheet" href="/assets/style.css">
    <script type="module" src="/assets/app.js"></script>
    <script type="module">
      import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
      window.mermaid = mermaid;
      mermaid.initialize({ startOnLoad: false });
    </script>
  </head>
  <body>
    <aside id="tree-pane">
      <div class="pane-header">
        <strong>mdiv</strong>
        <button id="theme-button" type="button" title="Toggle theme">◐</button>
      </div>
      <nav id="tree"></nav>
    </aside>
    <main id="preview" tabindex="-1"></main>
    <aside id="outline-pane">
      <div class="pane-header"><strong>Outline</strong></div>
      <nav id="outline"></nav>
    </aside>
  </body>
</html>`;

export const STYLE_CSS = `:root {
  color-scheme: light;
  --bg: #f7f7f4;
  --panel: #ffffff;
  --text: #222426;
  --muted: #667085;
  --border: #d8d8d2;
  --accent: #256f7a;
  --code: #f0f1ed;
}

[data-theme="dark"] {
  color-scheme: dark;
  --bg: #181a1b;
  --panel: #202325;
  --text: #ecefed;
  --muted: #a7b0ad;
  --border: #3a3f3d;
  --accent: #5fb8c5;
  --code: #2a2e30;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr) minmax(180px, 260px);
  min-height: 100vh;
  background: var(--bg);
  color: var(--text);
  font: 15px/1.6 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

aside {
  background: var(--panel);
  border-color: var(--border);
  overflow: auto;
}

#tree-pane {
  border-right: 1px solid var(--border);
}

#outline-pane {
  border-left: 1px solid var(--border);
}

.pane-header {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 48px;
  padding: 0 14px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}

button {
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text);
  border-radius: 6px;
  min-width: 32px;
  min-height: 32px;
}

#tree,
#outline {
  padding: 12px;
}

.tree-list,
.outline-list {
  list-style: none;
  margin: 0;
  padding-left: 12px;
}

.tree-item,
.outline-link {
  display: block;
  width: 100%;
  padding: 4px 6px;
  border-radius: 6px;
  color: var(--text);
  text-decoration: none;
}

.tree-item.active,
.outline-link.active {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  color: var(--accent);
}

.dir-label {
  color: var(--muted);
  padding: 4px 6px;
}

#preview {
  width: min(100%, 980px);
  margin: 0 auto;
  padding: 32px 36px 72px;
  outline: none;
}

#preview img {
  max-width: 100%;
}

#preview pre {
  overflow: auto;
  padding: 14px;
  border-radius: 8px;
  background: var(--code);
}

#preview code {
  background: var(--code);
  padding: 0.15em 0.3em;
  border-radius: 4px;
}

#preview pre code {
  padding: 0;
}

#preview table {
  border-collapse: collapse;
  width: 100%;
}

#preview th,
#preview td {
  border: 1px solid var(--border);
  padding: 6px 8px;
}

.mdiv-toc ul {
  list-style: none;
  margin: 0;
  padding-left: 0;
}

.mdiv-toc-level-2 {
  padding-left: 12px;
}

.mdiv-toc-level-3 {
  padding-left: 24px;
}

.mdiv-toc-level-4 {
  padding-left: 36px;
}

.mdiv-toc-level-5,
.mdiv-toc-level-6 {
  padding-left: 48px;
}

@media (max-width: 900px) {
  body {
    grid-template-columns: 1fr;
  }

  #tree-pane,
  #outline-pane {
    max-height: 34vh;
    border: 0;
    border-bottom: 1px solid var(--border);
  }
}`;

export const APP_JS = `const treeEl = document.querySelector("#tree");
const previewEl = document.querySelector("#preview");
const outlineEl = document.querySelector("#outline");
const themeButton = document.querySelector("#theme-button");
let currentPath = new URLSearchParams(location.search).get("path");
let headings = [];

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("mdiv-theme", theme);
}

applyTheme(localStorage.getItem("mdiv-theme") || "light");
themeButton.addEventListener("click", () => {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
});

async function loadTree() {
  const response = await fetch("/api/tree");
  const data = await response.json();
  document.documentElement.dataset.flavor = data.flavor;
  if (!currentPath) currentPath = data.initialPagePath;
  treeEl.innerHTML = renderTree([data.root]);
  treeEl.querySelectorAll("[data-path]").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.preventDefault();
      navigate(item.dataset.path);
    });
  });
  highlightTree();
  if (currentPath) await loadPage(currentPath);
}

function renderTree(nodes) {
  return '<ul class="tree-list">' + nodes.map((node) => {
    const label = escapeHtml(node.name);
    const children = node.children?.length ? renderTree(node.children) : "";
    if (node.kind === "file") {
      return '<li><a class="tree-item" data-path="' + escapeHtml(node.path) + '" href="/?path=' + encodeURIComponent(node.path) + '">' + label + '</a>' + children + '</li>';
    }
    return '<li><div class="dir-label">' + label + '</div>' + children + '</li>';
  }).join("") + "</ul>";
}

async function navigate(path, anchor) {
  currentPath = path;
  const url = "/?path=" + encodeURIComponent(path) + (anchor ? "#" + anchor : "");
  history.pushState(null, "", url);
  await loadPage(path);
  highlightTree();
  if (anchor) scrollToAnchor(anchor);
}

async function loadPage(path) {
  const response = await fetch("/api/render?path=" + encodeURIComponent(path));
  if (!response.ok) {
    previewEl.textContent = await response.text();
    outlineEl.innerHTML = "";
    return;
  }
  const data = await response.json();
  headings = data.headings;
  document.title = data.title + " - mdiv";
  previewEl.innerHTML = data.html;
  renderOutline();
  await renderMermaid();
}

// Internal page links carry data-mdiv-* so navigation stays client side
// without the frontend having to re-parse the href the server produced.
previewEl.addEventListener("click", (event) => {
  const link = event.target.closest('a[data-mdiv-kind="page"]');
  if (!link || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
  event.preventDefault();
  navigate(link.dataset.mdivPath, link.dataset.mdivAnchor);
});

function scrollToAnchor(anchor) {
  const target = document.getElementById(anchor);
  if (target) target.scrollIntoView();
}

function renderOutline() {
  outlineEl.innerHTML = '<ul class="outline-list">' + headings.map((heading) => {
    return '<li><a class="outline-link" style="padding-left:' + (heading.level - 1) * 12 + 'px" href="#' + encodeURIComponent(heading.id) + '">' + escapeHtml(heading.text) + '</a></li>';
  }).join("") + "</ul>";
}

async function renderMermaid() {
  const mermaid = window.mermaid;
  if (!mermaid) return;
  const blocks = previewEl.querySelectorAll("code.language-mermaid");
  for (const [index, block] of [...blocks].entries()) {
    const container = document.createElement("div");
    container.className = "mermaid";
    const result = await mermaid.render("mdiv-mermaid-" + index + "-" + Date.now(), block.textContent || "");
    container.innerHTML = result.svg;
    block.closest("pre").replaceWith(container);
  }
}

function highlightTree() {
  treeEl.querySelectorAll(".tree-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.path === currentPath);
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

window.addEventListener("popstate", () => {
  currentPath = new URLSearchParams(location.search).get("path");
  if (currentPath) loadPage(currentPath).then(highlightTree);
});

const events = new EventSource("/api/events");
events.addEventListener("tree_changed", () => loadTree());
events.addEventListener("file_changed", () => {
  if (currentPath) loadPage(currentPath);
});

loadTree();`;
