# mdiv

`mdiv` is a local Bun + TypeScript CLI for reading Markdown in the browser. The core is a plain
local Markdown reader; Azure DevOps Wiki conventions are layered on top as an optional flavor. It is
designed for trusted local documents.

## Usage

```sh
bun install
bun run build:web        # build the React shell once
bun run dev -- [flags] [path]
```

While working on the frontend, run the API server and the Vite dev server side by side:

```sh
bun run dev -- [path]    # API on http://localhost:6275
bun run dev:web          # UI with hot reload on http://localhost:5173
```

CLI:

```sh
mdiv [flags] [path]
```

Flags:

- `--port <number>`: server port. Default: `6275`.
- `--bind <address>`: bind address. Default: `127.0.0.1`.
- `--flavor <name>`: `auto`, `plain`, or `ado`. Default: `auto`.
- `--allow-remote-access`: required to bind to anything but loopback.
- `--allow-remote-images`: let documents load images from the network.
- `--no-open`: do not open a browser.
- `--version`: print the version and exit.

Path behavior:

- No path: use the current directory as the wiki root.
- Markdown file path: use the parent directory as the wiki root and open that file first.
- Directory path: scan the directory recursively as the wiki root.
- Non-Markdown file path: fail.

## Flavors

A flavor layers wiki-specific conventions over the generic reader. With `--flavor auto` (the
default), `ado` is selected when the wiki root contains `.order` or `.attachments`; otherwise
`plain` is used.

| Behavior                  | `plain`              | `ado`                         |
| ------------------------- | -------------------- | ----------------------------- |
| Tree ordering             | Name                 | `.order`, then name           |
| `Guide.md` + `Guide/`     | Separate nodes       | Merged into one node          |
| `[[_TOC_]]`               | Literal text         | Rendered table of contents    |
| `::: mermaid`             | Literal text         | Rendered as a `mermaid` fence |
| `/Guide/Install` links    | Relative to the page | Resolved from the wiki root   |
| Extension-less page links | Treated as assets    | Resolved to `.md` pages       |

Dot-prefixed entries such as `.order` and `.attachments` are hidden from the tree in both flavors,
but remain reachable as assets. `node_modules` is skipped entirely, by both the tree scan and the
file watcher.

## Features

Core:

- Three-pane React UI: file tree, document, and outline, each pane resizable and collapsible.
- Pane widths, collapsed panes, and the theme are remembered across reloads.
- The open page is part of the URL (`/read/docs/architecture.md#data-flow`), so reload, back,
  forward, and bookmarks work. The URL never contains the workspace's absolute path.
- Markdown rendering with raw HTML enabled for trusted local preview.
- Outline extraction with stable, unique heading ids.
- Client-side navigation for internal links, plus browser back and forward.
- Live reload through Server-Sent Events.
- Light and dark themes.

Standard Markdown (GFM baseline via `markdown-it`):

- Tables, task lists, strikethrough, and autolinks.

Azure DevOps Wiki compatibility (`ado` flavor):

- `.order` files for tree ordering. Matching is case-insensitive and entries may omit `.md`.
- Page folders such as `Guide.md` plus `Guide/` become clickable tree nodes with children.
- `.attachments` is hidden from the tree but available to Markdown images and links.
- `[[_TOC_]]` markers, ignored inside fenced code blocks.
- `::: mermaid` blocks, rendered in the browser. Mermaid ships inside the binary as its own chunk
  and is loaded only for pages that contain a diagram, so it works offline.
- Root-absolute, extension-less, and percent-encoded page links, including Japanese and
  space-containing page names.

## API

- `GET /api/tree` — `{ flavor, mode, initialPagePath, root, files }`
- `GET /api/render?path=<markdown-path>` — `{ path, title, html, headings }`
- `GET /api/asset?path=<asset-path>`
- `GET /api/events`

Every other path serves the React shell: a built asset when one matches, otherwise `index.html`, so
`/read/<page-path>` survives a reload.

API paths are root-relative. Absolute paths and `..` traversal outside the wiki root are rejected
with `400`; safe paths that do not exist return `404`. Unknown paths under `/api/` return `404`.

Rendered links carry `data-mdiv-kind`, `data-mdiv-path`, and `data-mdiv-anchor` alongside
`href`, so a frontend can route internally without re-parsing URLs.

## Security

mdiv assumes the Markdown it is pointed at came from a repository nobody vouched for.

- **Local by default.** The server binds to `127.0.0.1`. Any other address needs
  `--allow-remote-access`, and prints a warning. On a loopback binding only loopback `Host` headers
  are answered, so a name that resolves to `127.0.0.1` cannot reach the wiki; cross-origin requests
  and anything other than `GET`/`HEAD` are refused.
- **Raw HTML is filtered, not trusted.** `src/core/sanitize.ts` rebuilds every surviving tag from an
  allowlist of elements and attributes. Scripts, styles, iframes, embedded SVG, event handlers, and
  `javascript:` / `data:text/html` URLs never reach the browser. `data:` images are limited to
  raster formats.
- **A Content Security Policy backs that up.** The shell allows scripts only from its own origin
  (the theme bootstrap runs under a hash, not `'unsafe-inline'`), forbids objects, frames, and
  framing, and blocks remote images unless `--allow-remote-images` is passed. API responses carry
  `default-src 'none'`, and assets are additionally `sandbox`ed so a wiki-local `.svg` or `.html`
  cannot run as a same-origin document.
- **Paths cannot leave the root.** Absolute paths, `..`, backslashes, Windows drive and UNC forms,
  control characters, and separators that survived one round of URL decoding are all rejected with
  `400`. Containment is re-checked against the resolved real path, so a symlink out of the root is
  refused whether or not its target exists. Responses never contain a filesystem path.
- **Mermaid runs with `securityLevel: "strict"`**, pinned in one place, and a diagram cannot
  override it.

## Architecture

```
src/
  cli.ts          argument parsing and startup
  core/           generic reader: paths, tree scan, Markdown pipeline, links, watcher
  flavors/        flavor contract, registry, plain, and ado/
  server/         routing, SSE hub, MIME
  web/
    index.html    Vite entry point
    app/          React shell: components, hooks, lib, design tokens
    bundle.ts     serves the built assets, embedded at build time
```

Flavors implement the optional hooks in `src/flavors/types.ts`; omitting a hook falls back to the
core behavior.

The frontend is built by Vite and then turned into a TypeScript module by `scripts/embed-web.ts`,
so `bun build --compile` produces a binary that carries its own UI. `src/core/readUrl.ts` holds the
one definition of the page URL scheme, shared by the server-rendered links and the router.

## Development

```sh
bun run test
bun run test:web
bun run typecheck
bun run check:version
bun run lint
bun run format:check
bun run check
bun run build
```

## Release

Update the project version in `package.json` and `src/version.ts`:

```sh
bun run version 0.1.1
```

Commit the version change, merge it to `main`, then push a matching tag:

```sh
git tag v0.1.1
git push origin v0.1.1
```
