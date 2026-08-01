import { afterEach, describe, expect, test } from "bun:test";
import { resolveWikiContext } from "../../src/core/context.ts";
import type { WatchFactory, WikiChangeEvent } from "../../src/core/watch.ts";
import { createWiredApp, type WiredApp } from "../../src/server/index.ts";
import type { TreeResponse } from "../../src/types.ts";
import { createWiki } from "../helpers/wiki.ts";

/** Structural view of a stream reader, so bun-types and lib.dom both satisfy it. */
type ChunkReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<void>;
};

type FakeWatcher = {
  factory: WatchFactory;
  emit: (event: WikiChangeEvent) => void;
  watchedRoot: () => string | null;
  closed: () => boolean;
};

/**
 * Stands in for chokidar so the wiring can be checked deterministically, and in
 * environments where filesystem watching is unavailable.
 */
function fakeWatcher(): FakeWatcher {
  let onChange: ((event: WikiChangeEvent) => void) | null = null;
  let watchedRoot: string | null = null;
  let closed = false;

  return {
    factory: (rootDir, handler) => {
      watchedRoot = rootDir;
      onChange = handler;
      return {
        close: async () => {
          closed = true;
        },
      };
    },
    emit: (event) => {
      if (!onChange) {
        throw new Error("createWiredApp never subscribed to the watcher");
      }
      onChange(event);
    },
    watchedRoot: () => watchedRoot,
    closed: () => closed,
  };
}

let wired: WiredApp | null = null;

afterEach(async () => {
  await wired?.close();
  wired = null;
});

describe("wired app", () => {
  test("auto-detects the ADO flavor through resolveWikiContext", async () => {
    const root = createWiki({ ".order": "Home\n", "Home.md": "# Home\n" });
    wired = createWiredApp(await resolveWikiContext(root), fakeWatcher().factory);

    const tree = await treeOf(wired);
    expect(tree.flavor).toBe("ado");
    expect(tree.files).toEqual(["Home.md"]);
  });

  test("uses the plain flavor for an ordinary Markdown directory", async () => {
    const root = createWiki({ "Home.md": "# Home\n" });
    wired = createWiredApp(await resolveWikiContext(root), fakeWatcher().factory);

    expect((await treeOf(wired)).flavor).toBe("plain");
  });

  test("watches the wiki root", async () => {
    const root = createWiki({ "Home.md": "# Home\n" });
    const watcher = fakeWatcher();
    wired = createWiredApp(await resolveWikiContext(root), watcher.factory);

    expect(watcher.watchedRoot()).toBe(root);
  });

  // The bug this guards: the handler and the watcher each owned a separate set
  // of SSE clients, so watcher events never reached a connected browser.
  test("forwards watcher events to a connected client", async () => {
    const root = createWiki({ "Home.md": "# Home\n" });
    const watcher = fakeWatcher();
    wired = createWiredApp(await resolveWikiContext(root), watcher.factory);

    const response = await wired.app.fetch(new Request("http://localhost/api/events"));
    const reader: ChunkReader = response.body!.getReader();
    expect(await readEvent(reader)).toContain("event: tree_changed");

    watcher.emit("file_changed");
    expect(await readEvent(reader)).toContain("event: file_changed");

    watcher.emit("tree_changed");
    expect(await readEvent(reader)).toContain("event: tree_changed");

    await reader.cancel();
  });

  test("closing the app closes the watcher", async () => {
    const root = createWiki({ "Home.md": "# Home\n" });
    const watcher = fakeWatcher();
    const target = createWiredApp(await resolveWikiContext(root), watcher.factory);

    await target.close();
    expect(watcher.closed()).toBe(true);
  });
});

async function treeOf(target: WiredApp): Promise<TreeResponse> {
  const response = await target.app.fetch(new Request("http://localhost/api/tree"));
  return (await response.json()) as TreeResponse;
}

async function readEvent(reader: ChunkReader): Promise<string> {
  const result = await reader.read();
  if (result.done) {
    throw new Error("stream closed before an event arrived");
  }
  return new TextDecoder().decode(result.value);
}
