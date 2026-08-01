import { PathSafetyError } from "../core/path.ts";
import { scanWiki } from "../core/tree.ts";
import type { WikiContext } from "../types.ts";
import { APP_JS, INDEX_HTML, STYLE_CSS } from "../web/assets.ts";
import { HttpError, jsonResponse, textResponse } from "./http.ts";
import { assetRoute } from "./routes/asset.ts";
import { renderRoute } from "./routes/render.ts";
import { createSseHub, type SseHub } from "./sse.ts";

export type MarkadoApp = {
  fetch: (request: Request) => Promise<Response>;
  hub: SseHub;
};

export function createApp(context: WikiContext): MarkadoApp {
  const hub = createSseHub();

  const fetch = async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    try {
      switch (url.pathname) {
        case "/":
          return textResponse(INDEX_HTML, "text/html; charset=utf-8");
        case "/assets/style.css":
          return textResponse(STYLE_CSS, "text/css; charset=utf-8");
        case "/assets/app.js":
          return textResponse(APP_JS, "text/javascript; charset=utf-8");
        case "/api/tree":
          return jsonResponse(await scanWiki(context));
        case "/api/render":
          return await renderRoute(context, url);
        case "/api/asset":
          return await assetRoute(context, url);
        case "/api/events":
          return hub.connect();
        default:
          return new Response("Not found", { status: 404 });
      }
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
