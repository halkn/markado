import type { WikiChangeEvent } from "../core/watch.ts";

type SseClient = {
  send: (event: WikiChangeEvent) => void;
  close: () => void;
};

/**
 * Single registry of connected Server-Sent Events clients. The request handler
 * and the file watcher share one hub, so tests exercise the same path the CLI
 * does.
 */
export type SseHub = {
  connect: () => Response;
  emit: (event: WikiChangeEvent) => void;
  closeAll: () => void;
  readonly size: number;
};

export function createSseHub(): SseHub {
  const clients = new Set<SseClient>();

  return {
    connect: () => connect(clients),
    emit: (event) => {
      for (const client of clients) {
        client.send(event);
      }
    },
    closeAll: () => {
      for (const client of clients) {
        client.close();
      }
      clients.clear();
    },
    get size() {
      return clients.size;
    },
  };
}

function connect(clients: Set<SseClient>): Response {
  const encoder = new TextEncoder();
  let client: SseClient | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const drop = () => {
        if (client) {
          clients.delete(client);
        }
      };

      client = {
        send: (event) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: {}\n\n`));
          } catch {
            drop();
          }
        },
        close: () => {
          drop();
          try {
            controller.close();
          } catch {
            // Already closed by the client disconnecting.
          }
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
