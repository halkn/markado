import { watchWiki } from "../core/watch.ts";
import type { WikiContext } from "../types.ts";
import { createApp } from "./handler.ts";

export type MarkadoServer = {
  url: string;
  stop: () => Promise<void>;
};

export { createApp, createRequestHandler, type MarkadoApp } from "./handler.ts";

export async function startMarkadoServer(
  context: WikiContext,
  bind: string,
  port: number,
): Promise<MarkadoServer> {
  const app = createApp(context);
  const server = Bun.serve({ hostname: bind, port, fetch: app.fetch });
  const watcher = watchWiki(context.rootDir, (event) => app.hub.emit(event));

  return {
    url: `http://${bind}:${server.port}/`,
    stop: async () => {
      await watcher.close();
      app.hub.closeAll();
      server.stop(true);
    },
  };
}
