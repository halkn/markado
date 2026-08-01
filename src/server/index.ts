import { watchWiki, type WatchFactory, type WikiWatcher } from "../core/watch.ts";
import type { WikiContext } from "../types.ts";
import { createApp, type MdivApp } from "./handler.ts";

export type MdivServer = {
  url: string;
  stop: () => Promise<void>;
};

/** The app and its file watcher, wired together but not yet listening. */
export type WiredApp = {
  app: MdivApp;
  watcher: WikiWatcher;
  close: () => Promise<void>;
};

export { createApp, createRequestHandler, type MdivApp } from "./handler.ts";

/**
 * Split out from `startMdivServer` so the watcher-to-hub wiring can be
 * tested without binding a socket or relying on real filesystem events. A
 * broken connection here is invisible to tests that emit on the hub directly.
 */
export function createWiredApp(
  context: WikiContext,
  createWatcher: WatchFactory = watchWiki,
): WiredApp {
  const app = createApp(context);
  const watcher = createWatcher(context.rootDir, (event) => app.hub.emit(event));

  return {
    app,
    watcher,
    close: async () => {
      await watcher.close();
      app.hub.closeAll();
    },
  };
}

export async function startMdivServer(
  context: WikiContext,
  bind: string,
  port: number,
): Promise<MdivServer> {
  const wired = createWiredApp(context);
  const server = Bun.serve({ hostname: bind, port, fetch: wired.app.fetch });

  return {
    url: `http://${bind}:${server.port}/`,
    stop: async () => {
      await wired.close();
      server.stop(true);
    },
  };
}
