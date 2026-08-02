# CLAUDE.md

`mdiv` is a Bun + TypeScript CLI that previews local Markdown in the browser.

## Commands

```sh
bun run check     # check:version + typecheck + lint + format:check + test
bun run test      # server tests, then web tests (separate processes)
bun run build     # build:web + build:embed + bun build
bun run dev -- [flags] [path]
bun run dev:web   # Vite dev server on 5173, proxying /api to 6275
```

At minimum, get `bun run check` passing before you call a change done.

`bun run` enumerates parent directories while looking for the project root, so it fails to start under a sandbox that denies reads above the project. Call the tools directly in that case:

```sh
bun test test/core test/flavors test/server
bun test --preload ./test/setup/dom.ts test/web
bun scripts/check-version.ts
./node_modules/.bin/tsc --noEmit -p tsconfig.json
./node_modules/.bin/tsc --noEmit -p tsconfig.web.json
./node_modules/.bin/oxlint
./node_modules/.bin/oxfmt --check .
```

## Architecture

```
src/
  cli.ts     argument parsing and startup only
  core/      the generic Markdown reader (flavor agnostic)
  flavors/   flavor contract, registry, plain, and ado/
  server/    routing, SSE hub, MIME
  web/       React shell (Vite + Tailwind + shadcn/ui + TanStack Router)
    app/       components/, hooks/, lib/, styles.css
    bundle.ts  serves the built assets; generated/ is not committed
```

### Boundaries to hold

- **Keep wiki-specific behavior out of `core/`.** Everything Azure DevOps Wiki does differently — `.order`, `Page.md` plus `Page/`, `[[_TOC_]]`, `::: mermaid`, root-absolute links — lives in `flavors/ado/`. A new dialect goes under `flavors/` too.
- **Every flavor hook is optional** and falls back to the core default (`src/flavors/types.ts`). That the `plain` flavor works with no hooks at all is what proves the separation still holds.
- **`src/core/readUrl.ts` is the only definition of the page URL scheme**, and `toHref` (`src/core/links.ts`) is its only consumer on the server side. Renderers and flavors return a `LinkTarget`, and the HTML carries `data-mdiv-*`; the router imports the same module, so a server-rendered `href` and a client route cannot drift apart.
- **React owns the shell, the server owns the Markdown HTML.** `DocumentView` injects `RenderResponse.html`. Rendering concerns belong in `core/` or a flavor, not in a component.
- **Nothing writes into the document DOM after React has committed it.** Whatever the browser has to add — Mermaid diagrams — rewrites the HTML string first (`renderMermaidHtml`, `useMermaidHtml`), and React injects the result. The document is re-injected more often than it looks, and a mutation applied afterwards is either wiped or, when the re-injection lands between the query and the write, applied to nodes that are no longer attached: the render reports success and the reader sees nothing.
- **The frontend loads nothing from the network.** A local reader must work offline, so every dependency is bundled; Mermaid is imported dynamically (`src/web/app/lib/mermaid.ts`) so it becomes its own chunk instead of weighing down the entry. `scripts/embed-web.ts` fails the build if a static remote import reaches the output: Vite hoists inline module scripts in `index.html` into the entry chunk, and an unreachable host there stops the whole app from evaluating — a blank page, not a missing feature.
- **The frontend ships inside the binary.** `vite build` writes `dist/web/`, `scripts/embed-web.ts` turns it into `src/web/generated/bundle.ts`, and `src/web/bundle.ts` imports that dynamically so `bun test` and `tsc` still work without a Vite build. Anything Vite emits must be UTF-8 text; binary assets have to be inlined as data URIs.
- **Markdown is one pass: parse, assign heading ids, render** (`src/core/markdown.ts`). Building the token stream twice lets `[[_TOC_]]` anchors drift from the `id` attributes in the body.
- **Write syntax extensions as markdown-it rules, not string substitution.** Substitution also rewrites the inside of fenced code blocks.
- **The tree scan and the watcher must agree on what to skip** (`src/core/ignore.ts`). Watching `node_modules` starves the event loop for minutes: the server listens, but never answers a request, so the browser shows a blank page with nothing in the console.
- **Path safety is two separate checks** (`src/core/path.ts`): `assertSafeRelativePath` runs the lexical one and then the symlink one, and only after both does a route ask whether the file exists. The lexical check tolerates missing paths, so "outside the root" is still a 400 and "simply missing" still a 404 — but a symlink out of the root now answers alike either way, instead of letting the 400/404 split reveal what is out there.

### The wiki is untrusted input

mdiv is pointed at repositories nobody vouched for, so a document may be actively hostile. These are load-bearing:

- **Raw HTML goes through the allowlist in `src/core/sanitize.ts`, and nothing else.** It is installed as the `html_block` / `html_inline` renderer rules, so it filters the document's markup without touching the renderer's own. Every surviving tag is **rebuilt** from its parsed name and attributes: passing the original text through would let whatever the scanner failed to parse decide what the browser sees, and re-escaping on the way out is also what makes `java&#115;cript:` inert. Widening the allowlist is a security decision — `<svg>` and `<style>` are absent on purpose, and `<input>` is accepted only as a task-list checkbox.
- **`src/server/headers.ts` is the only definition of the response headers**, CSP included. A route that builds its own headers is a route that ships without a policy. The shell's inline theme script is covered by a hash read back out of the HTML being served, so it follows the Vite build; `script-src` must never gain `'unsafe-inline'`. `style-src` cannot be tightened the same way — Mermaid puts a `<style>` inside every SVG it generates, and Radix and react-resizable-panels position themselves with inline `style`.
- **`mermaidConfig()` (`src/web/app/lib/mermaid.ts`) is the only place Mermaid is configured**, and `securityLevel` is pinned rather than inherited. Nothing from a document reaches it.
- **The watcher does not follow symlinks** (`src/core/watch.ts`). It would watch directories the server refuses to serve, and a link back to an ancestor walks until the kernel answers ELOOP — which used to arrive as an unhandled error and kill the process seconds after it started listening.
- **Responses never quote a filesystem path.** `errorResponse` (`src/server/http.ts`) answers 500 with a fixed string and logs the detail; Node puts the absolute path in every fs error message.

## Development style

- TDD, except for config files, docs, and small fixes.
- Push statically checkable rules into oxlint / oxfmt / tsc rather than compensating in comments.
- Comment only where the _why_ is non-obvious. Do not describe _what_ the code does.
- A `PostToolUse` hook runs `oxfmt --write` on edited files (`.claude/settings.json`).
- shadcn/ui components live in `src/web/app/components/ui/`. Add them with `bunx shadcn@latest add <name>`, then move them out of the `@/` directory the CLI creates. They expect shadcn's token names (`primary`, `accent`, `muted`, …), which `styles.css` maps onto the `--mdiv-*` palette; `accent` there means a hover surface, not the brand colour.

## Tests

`test/` mirrors `src/`. Build a wiki in a temporary directory with `createWiki()` from `test/helpers/wiki.ts`.

`test/web` runs in a separate `bun test` process with `--preload ./test/setup/dom.ts`. It has to: registering happy-dom globally replaces `Response`, and the asset route hands a `BunFile` to it. Do not move that preload into a shared `bunfig.toml`.

Layout that depends on measured element sizes (pane collapse, resizing) cannot be asserted under happy-dom. Test the control and its state, and verify the behavior in a browser.

The server tests are split into three layers. Check which one a new test belongs in.

| File                              | Covers                   | Socket  | File watching            |
| --------------------------------- | ------------------------ | ------- | ------------------------ |
| `test/server/handler.test.ts`     | routing, status codes    | no      | no                       |
| `test/server/wiring.test.ts`      | watcher to hub to client | no      | no (watcher is injected) |
| `test/server/integration.test.ts` | real HTTP, real chokidar | **yes** | **yes**                  |

`integration.test.ts` only passes where both socket binding and filesystem watching are available. If it fails inside a sandbox, suspect the environment first — `Bun.serve` reporting `EADDRINUSE` on every port means binding is blocked outright.

## Release

The version lives in both `package.json` and `src/version.ts`, and `bun run check:version` asserts they agree. Use `bun run version <x.y.z>` to update both.

The release workflow builds the web bundle before compiling the binaries; a binary built without that step falls back to a placeholder page.
