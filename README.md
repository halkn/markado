# markado

`markado` is a local Bun + TypeScript CLI for previewing a Markdown wiki in the browser. It is designed for trusted local documents and includes practical Azure DevOps Wiki compatibility for page folders, `.order`, `.attachments`, TOC markers, and Mermaid blocks.

## Usage

```sh
bun install
bun run dev -- [flags] [path]
```

CLI:

```sh
markado [flags] [path]
```

Flags:

- `--port <number>`: server port. Default: `6275`.
- `--bind <address>`: bind address. Default: `localhost`.
- `--no-open`: do not open a browser.
- `--version`: print the version and exit.

Path behavior:

- No path: use the current directory as the wiki root.
- Markdown file path: use the parent directory as the wiki root and open that file first.
- Directory path: scan the directory recursively as the wiki root.
- Non-Markdown file path: fail.

## Features

- Three-pane browser UI: tree, preview, and outline.
- Markdown rendering with raw HTML enabled for trusted local preview.
- GitHub-style task lists via `markdown-it-task-lists`.
- Azure DevOps Wiki-style `::: mermaid` blocks, rendered in the browser with Mermaid from CDN.
- Azure DevOps Wiki TOC markers replaced with heading links.
- `.order` files for tree ordering. Matching is case-insensitive and entries may omit `.md`.
- Page folders such as `Guide.md` plus `Guide/` become clickable tree nodes with children.
- `.attachments` is hidden from the tree but available to Markdown images and links.
- Live reload through Server-Sent Events.

## API

- `GET /api/tree`
- `GET /api/render?path=<markdown-path>`
- `GET /api/asset?path=<asset-path>`
- `GET /api/events`

API paths are root-relative. Absolute paths and `..` traversal outside the wiki root are rejected.

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
