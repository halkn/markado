# CLAUDE.md

`mdiv` is a Bun + TypeScript CLI that previews local Markdown in the browser.

## Commands

```sh
bun run check   # check:version + typecheck + lint + format:check + test
bun run test
bun run build
bun run dev -- [flags] [path]
```

At minimum, get `bun run check` passing before you call a change done.

`bun run` enumerates parent directories while looking for the project root, so it fails to start under a sandbox that denies reads above the project. Call the tools directly in that case:

```sh
bun test
bun scripts/check-version.ts
./node_modules/.bin/tsc --noEmit -p tsconfig.json
./node_modules/.bin/oxlint
./node_modules/.bin/oxfmt --check src test
```

## Architecture

```
src/
  cli.ts     argument parsing and startup only
  core/      the generic Markdown reader (flavor agnostic)
  flavors/   flavor contract, registry, plain, and ado/
  server/    routing, SSE hub, MIME
  web/       browser assets as string literals (not yet React)
```

### Boundaries to hold

- **Keep wiki-specific behavior out of `core/`.** Everything Azure DevOps Wiki does differently — `.order`, `Page.md` plus `Page/`, `[[_TOC_]]`, `::: mermaid`, root-absolute links — lives in `flavors/ado/`. A new dialect goes under `flavors/` too.
- **Every flavor hook is optional** and falls back to the core default (`src/flavors/types.ts`). That the `plain` flavor works with no hooks at all is what proves the separation still holds.
- **Only `toHref` may know the URL scheme** (`src/core/links.ts`). Renderers and flavors return a `LinkTarget`, and the HTML carries `data-mdiv-*`. This is what lets the frontend be replaced without touching either.
- **Markdown is one pass: parse, assign heading ids, render** (`src/core/markdown.ts`). Building the token stream twice lets `[[_TOC_]]` anchors drift from the `id` attributes in the body.
- **Write syntax extensions as markdown-it rules, not string substitution.** Substitution also rewrites the inside of fenced code blocks.
- **Path safety is two separate checks** (`src/core/path.ts`): call `resolveSafePath`, then check existence, then `assertRealPathWithinRoot`. That order is what makes "outside the root" a 400 and "simply missing" a 404.

## Development style

- TDD, except for config files, docs, and small fixes.
- Push statically checkable rules into oxlint / oxfmt / tsc rather than compensating in comments.
- Comment only where the _why_ is non-obvious. Do not describe _what_ the code does.
- A `PostToolUse` hook runs `oxfmt --write` on edited files (`.claude/settings.json`).

## Tests

`test/` mirrors `src/`. Build a wiki in a temporary directory with `createWiki()` from `test/helpers/wiki.ts`.

The server tests are split into three layers. Check which one a new test belongs in.

| File                              | Covers                   | Socket  | File watching            |
| --------------------------------- | ------------------------ | ------- | ------------------------ |
| `test/server/handler.test.ts`     | routing, status codes    | no      | no                       |
| `test/server/wiring.test.ts`      | watcher to hub to client | no      | no (watcher is injected) |
| `test/server/integration.test.ts` | real HTTP, real chokidar | **yes** | **yes**                  |

`integration.test.ts` only passes where both socket binding and filesystem watching are available. If it fails inside a sandbox, suspect the environment first — `Bun.serve` reporting `EADDRINUSE` on every port means binding is blocked outright.

## Release

The version lives in both `package.json` and `src/version.ts`, and `bun run check:version` asserts they agree. Use `bun run version <x.y.z>` to update both.
