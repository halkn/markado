# mdiv

`mdiv` is a local Bun + TypeScript CLI for reading Markdown in the browser. The core is a plain
local Markdown reader; Azure DevOps Wiki conventions are layered on top as an optional flavor. It is
designed for trusted local documents.

## Usage

```sh
bun install
bun run dev -- [flags] [path]
```

CLI:

```sh
mdiv [flags] [path]
```

Flags:

- `--port <number>`: server port. Default: `6275`.
- `--bind <address>`: bind address. Default: `localhost`.
- `--flavor <name>`: `auto`, `plain`, or `ado`. Default: `auto`.
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
but remain reachable as assets.

## Features

Core:

- Three-pane browser UI: tree, preview, and outline.
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
- `::: mermaid` blocks, rendered in the browser with Mermaid from CDN.
- Root-absolute, extension-less, and percent-encoded page links, including Japanese and
  space-containing page names.

## API

- `GET /api/tree` — `{ flavor, mode, initialPagePath, root, files }`
- `GET /api/render?path=<markdown-path>` — `{ path, title, html, headings }`
- `GET /api/asset?path=<asset-path>`
- `GET /api/events`

API paths are root-relative. Absolute paths and `..` traversal outside the wiki root are rejected
with `400`; safe paths that do not exist return `404`.

Rendered links carry `data-mdiv-kind`, `data-mdiv-path`, and `data-mdiv-anchor` alongside
`href`, so a frontend can route internally without re-parsing URLs.

## Architecture

```
src/
  cli.ts          argument parsing and startup
  core/           generic reader: paths, tree scan, Markdown pipeline, links, watcher
  flavors/        flavor contract, registry, plain, and ado/
  server/         routing, SSE hub, MIME
  web/            browser assets
```

Flavors implement the optional hooks in `src/flavors/types.ts`; omitting a hook falls back to the
core behavior.

## Development

```sh
bun run test
bun run typecheck
bun run check:version
bun run lint
bun run format:check
bun run check
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
