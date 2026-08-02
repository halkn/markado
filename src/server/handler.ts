import { scanWiki } from "../core/tree.ts";
import type { WikiContext } from "../types.ts";
import { indexHtml, webAsset } from "../web/bundle.ts";
import { securityHeaders, shellCsp } from "./headers.ts";
import { errorResponse, jsonResponse, textResponse } from "./http.ts";
import { contentType } from "./mime.ts";
import { assertAllowedRequest } from "./origin.ts";
import { assetRoute } from "./routes/asset.ts";
import { renderRoute } from "./routes/render.ts";
import { DEFAULT_SECURITY, type SecurityOptions } from "./security.ts";
import { createSseHub, type SseHub } from "./sse.ts";

/** Where Vite emits hashed bundles; see `build.assetsDir` in `vite.config.ts`. */
const ASSET_PREFIX = "/assets";

const INDEX_PATH = "/index.html";

export type MdivApp = {
  fetch: (request: Request) => Promise<Response>;
  hub: SseHub;
};

export function createApp(
  context: WikiContext,
  security: SecurityOptions = DEFAULT_SECURITY,
): MdivApp {
  const hub = createSseHub();

  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    try {
      assertAllowedRequest(request, url, security);

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
        return textResponse("Not found", 404);
      }

      return await shellResponse(url.pathname, security);
    } catch (error) {
      return errorResponse(error);
    }
  };

  return { fetch, hub };
}

export function createRequestHandler(
  context: WikiContext,
  security?: SecurityOptions,
): (request: Request) => Promise<Response> {
  return createApp(context, security).fetch;
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
async function shellResponse(pathname: string, security: SecurityOptions): Promise<Response> {
  // `/index.html` is the shell under another name; letting it take the asset
  // branch would cache the document that names the hashed bundles forever.
  const asset = pathname === INDEX_PATH ? null : await webAsset(pathname);
  if (asset !== null) {
    const mimeType = contentType(pathname);
    return new Response(asset, {
      headers: {
        "Content-Type": mimeType.includes("charset") ? mimeType : `${mimeType}; charset=utf-8`,
        "Cache-Control": "public, max-age=31536000, immutable",
        ...securityHeaders(shellCsp("", security)),
      },
    });
  }

  if (pathname.startsWith(`${ASSET_PREFIX}/`)) {
    return textResponse("Not found", 404);
  }

  const html = await indexHtml();
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // The shell names hashed bundles, so a cached copy outlives its assets.
      "Cache-Control": "no-store",
      ...securityHeaders(shellCsp(html, security)),
    },
  });
}
