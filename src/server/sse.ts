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

/**
 * Comments (`:` lines) are ignored by `EventSource`, so they open and hold the
 * stream without looking like a change. Greeting a client with a real event
 * instead made every reconnect reload the view, and a silent stream is dropped
 * by `Bun.serve`'s idle timeout, which reconnects on a loop.
 */
const HEARTBEAT_MS = 5_000;

function connect(clients: Set<SseClient>): Response {
  const encoder = new TextEncoder();
  let client: SseClient | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const drop = () => {
        if (heartbeat) {
          clearInterval(heartbeat);
          heartbeat = null;
        }
        if (client) {
          clients.delete(client);
        }
      };

      const write = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          drop();
        }
      };

      client = {
        send: (event) => write(`event: ${event}\ndata: {}\n\n`),
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
      write(": connected\n\n");
      heartbeat = setInterval(() => write(": ping\n\n"), HEARTBEAT_MS);
      // The server's own lifetime decides when to stop, not this timer.
      heartbeat.unref?.();
    },
    cancel() {
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
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
