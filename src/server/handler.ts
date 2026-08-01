import { PathSafetyError } from "../core/path.ts";
import { scanWiki } from "../core/tree.ts";
import type { WikiContext } from "../types.ts";
import { indexHtml, webAsset } from "../web/bundle.ts";
import { HttpError, jsonResponse } from "./http.ts";
import { contentType } from "./mime.ts";
import { assetRoute } from "./routes/asset.ts";
import { renderRoute } from "./routes/render.ts";
import { createSseHub, type SseHub } from "./sse.ts";

/** Where Vite emits hashed bundles; see `build.assetsDir` in `vite.config.ts`. */
const ASSET_PREFIX = "/assets";

export type MdivApp = {
  fetch: (request: Request) => Promise<Response>;
  hub: SseHub;
};

export function createApp(context: WikiContext): MdivApp {
  const hub = createSseHub();

  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case "/api/tree":
          return jsonResponse(await scanWiki(context));
        case "/api/render":
          return await renderRoute(context, url);
        case "/api/asset":
          return await assetRoute(context, url);
        case "/api/events":
          return hub.connect();
      }

      if (url.pathname.startsWith("/api/")) {
        return new Response("Not found", { status: 404 });
      }

      return await shellResponse(url.pathname);
    } catch (error) {
      return errorResponse(error);
    }
  };

  return { fetch, hub };
}

export function createRequestHandler(
  context: WikiContext,
): (request: Request) => Promise<Response> {
  return createApp(context).fetch;
}

/**
 * Anything that is not an API call is the single page app: a built asset when
 * one matches, otherwise the shell, so `/read/...` survives a reload.
 *
 * `/assets/` is excluded from that fallback on purpose. Those filenames carry a
 * content hash, so a request for one that is missing comes from a stale page;
 * returning the shell would answer a module request with HTML, which the
 * browser rejects without rendering anything.
 */
async function shellResponse(pathname: string): Promise<Response> {
  const asset = await webAsset(pathname);
  if (asset !== null) {
    const mimeType = contentType(pathname);
    return new Response(asset, {
      headers: {
        "Content-Type": mimeType.includes("charset") ? mimeType : `${mimeType}; charset=utf-8`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  }

  if (pathname.startsWith(`${ASSET_PREFIX}/`)) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(await indexHtml(), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The shell names hashed bundles, so a cached copy outlives its assets.
      "Cache-Control": "no-store",
    },
  });
}

function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return new Response(error.message, { status: error.status });
  }
  if (error instanceof PathSafetyError) {
    return new Response(error.message, { status: 400 });
  }
  return new Response(error instanceof Error ? error.message : "Internal server error", {
    status: 500,
  });
}
