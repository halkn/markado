const INDEX_PATH = "/index.html";

const PLACEHOLDER_HTML = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8"><title>mdiv</title></head>
  <body>
    <p>The web bundle has not been built. Run <code>bun run build:web</code>.</p>
  </body>
</html>
`;

/**
 * The React shell as built by Vite, embedded at bundle time so a compiled
 * binary carries its own frontend. The import is deliberately dynamic: without
 * it, `bun test` and `tsc` would require a Vite build to have run first.
 */
const assets: Promise<Record<string, string>> = import("./generated/bundle.ts")
  .then((module) => module.WEB_ASSETS)
  .catch(() => ({ [INDEX_PATH]: PLACEHOLDER_HTML }));

export async function webAsset(pathname: string): Promise<string | null> {
  return (await assets)[pathname] ?? null;
}

export async function indexHtml(): Promise<string> {
  return (await assets)[INDEX_PATH] ?? PLACEHOLDER_HTML;
}
