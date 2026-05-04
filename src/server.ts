import { watch, type FSWatcher } from "chokidar";
import { extname, relative } from "node:path";
import { assertSafeRelativePath, isMarkdownPath, normalizeRootRelativePath } from "./path.ts";
import { renderMarkdown } from "./markdown.ts";
import { scanWiki } from "./wiki.ts";
import type { WikiContext } from "./types.ts";
import { APP_JS, INDEX_HTML, STYLE_CSS } from "./webAssets.ts";

type SseClient = {
  send: (eventName: "tree_changed" | "file_changed") => void;
  close: () => void;
};

export type MarkadoServer = {
  url: string;
  stop: () => Promise<void>;
};

export function createRequestHandler(
  context: WikiContext,
): (request: Request) => Response | Promise<Response> {
  const clients = new Set<SseClient>();

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);

    try {
      if (url.pathname === "/") {
        return textResponse(INDEX_HTML, "text/html; charset=utf-8");
      }
      if (url.pathname === "/assets/style.css") {
        return textResponse(STYLE_CSS, "text/css; charset=utf-8");
      }
      if (url.pathname === "/assets/app.js") {
        return textResponse(APP_JS, "text/javascript; charset=utf-8");
      }
      if (url.pathname === "/api/tree") {
        return jsonResponse(scanWiki(context));
      }
      if (url.pathname === "/api/render") {
        return await renderRoute(context, url);
      }
      if (url.pathname === "/api/asset") {
        return await assetRoute(context, url);
      }
      if (url.pathname === "/api/events") {
        return eventsRoute(clients);
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      return new Response(error instanceof Error ? error.message : "Internal server error", {
        status: 400,
      });
    }
  };
}

export async function startMarkadoServer(
  context: WikiContext,
  bind: string,
  port: number,
): Promise<MarkadoServer> {
  const clients = new Set<SseClient>();
  const fetch = createRequestHandlerWithClients(context, clients);
  const server = Bun.serve({ hostname: bind, port, fetch });
  const watcher = watch(context.rootDir, {
    ignoreInitial: true,
    ignored: (path) => shouldIgnoreWatchPath(relative(context.rootDir, path)),
  });

  installWatcher(watcher, clients);

  return {
    url: `http://${bind}:${server.port}/`,
    stop: async () => {
      await watcher.close();
      server.stop(true);
    },
  };
}

function createRequestHandlerWithClients(
  context: WikiContext,
  clients: Set<SseClient>,
): (request: Request) => Response | Promise<Response> {
  const baseHandler = createRequestHandler(context);
  return (request) => {
    if (new URL(request.url).pathname === "/api/events") {
      return eventsRoute(clients);
    }
    return baseHandler(request);
  };
}

function installWatcher(watcher: FSWatcher, clients: Set<SseClient>): void {
  const emit = (eventName: "tree_changed" | "file_changed") => {
    for (const client of clients) {
      client.send(eventName);
    }
  };

  watcher.on("add", (path) => emit(isMarkdownPath(path) ? "tree_changed" : "file_changed"));
  watcher.on("unlink", () => emit("tree_changed"));
  watcher.on("addDir", () => emit("tree_changed"));
  watcher.on("unlinkDir", () => emit("tree_changed"));
  watcher.on("change", (path) => emit(path.endsWith(".order") ? "tree_changed" : "file_changed"));
}

function shouldIgnoreWatchPath(pathname: string): boolean {
  return pathname
    .replaceAll("\\", "/")
    .split("/")
    .some((part) => part.startsWith(".") && part !== ".attachments" && part !== ".order");
}

async function renderRoute(context: WikiContext, url: URL): Promise<Response> {
  const pagePath = requiredPathParam(url);
  if (!isMarkdownPath(pagePath)) {
    throw new Error("Render path must be a Markdown file");
  }

  const absolutePath = await assertSafeRelativePath(context.rootDir, pagePath);
  const source = await Bun.file(absolutePath).text();
  return jsonResponse(renderMarkdown(normalizeRootRelativePath(pagePath), source));
}

async function assetRoute(context: WikiContext, url: URL): Promise<Response> {
  const assetPath = requiredPathParam(url);
  const absolutePath = await assertSafeRelativePath(context.rootDir, assetPath);
  const file = Bun.file(absolutePath);
  if (!(await file.exists())) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(file, {
    headers: {
      "Content-Type": contentType(assetPath),
    },
  });
}

function eventsRoute(clients: Set<SseClient>): Response {
  let client: SseClient | null = null;
  const stream = new ReadableStream({
    start(controller) {
      client = {
        send: (eventName) => {
          controller.enqueue(new TextEncoder().encode(`event: ${eventName}\ndata: {}\n\n`));
        },
        close: () => {
          controller.close();
        },
      };
      clients.add(client);
      client.send("tree_changed");
    },
    cancel() {
      if (client) {
        clients.delete(client);
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

function requiredPathParam(url: URL): string {
  const value = url.searchParams.get("path");
  if (!value) {
    throw new Error("Missing path parameter");
  }
  return value;
}

function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

function textResponse(value: string, mimeType: string): Response {
  return new Response(value, {
    headers: { "Content-Type": mimeType },
  });
}

function contentType(pathname: string): string {
  switch (extname(pathname).toLowerCase()) {
    case ".css":
      return "text/css";
    case ".html":
      return "text/html";
    case ".js":
      return "text/javascript";
    case ".json":
      return "application/json";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".svg":
      return "image/svg+xml";
    case ".pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}
