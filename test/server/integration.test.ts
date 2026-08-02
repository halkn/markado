import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { resolveWikiContext } from "../../src/core/context.ts";
import { startMdivServer, type MdivServer } from "../../src/server/index.ts";
import type { TreeResponse } from "../../src/types.ts";
import { createWiki } from "../helpers/wiki.ts";

/** Structural view of a stream reader, so bun-types and lib.dom both satisfy it. */
type ChunkReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<void>;
};

describe("end-to-end server", () => {
  let root: string;
  let server: MdivServer;

  beforeAll(async () => {
    root = createWiki({
      ".order": "Home\n",
      "Home.md": "# Home\n",
      "Guide/Intro.md": "# Intro\n",
    });
    server = await startMdivServer(await resolveWikiContext(root), "localhost", 0);
  });

  afterAll(async () => {
    await server.stop();
  });

  test("detects the ADO flavor from the wiki root", async () => {
    const tree = (await (await fetch(`${server.url}api/tree`)).json()) as TreeResponse;
    expect(tree.flavor).toBe("ado");
  });

  // The markup itself comes from the Vite build, which `bun run check` does not
  // run, so this asserts the routing instead: every non-API path answers with
  // the shell, which is what lets `/read/...` survive a reload.
  test("serves the app shell for the root and for page URLs", async () => {
    for (const path of ["", "read/Home.md", "read/Guide/Intro.md"]) {
      // Each response has to be read before the next request is made.
      // oxlint-disable-next-line no-await-in-loop
      const response = await fetch(server.url + path);
      expect(response.status).toBe(200);
      expect(response.headers.get("Content-Type")).toContain("text/html");
      // oxlint-disable-next-line no-await-in-loop
      expect(await response.text()).toContain("<!doctype html>");
    }
  });

  test("answers 404 for a bundled asset that does not exist", async () => {
    const response = await fetch(`${server.url}assets/stale-x1.js`);
    expect(response.status).toBe(404);
  });

  test("pushes a file_changed event when a page is edited", async () => {
    const response = await fetch(`${server.url}api/events`);
    const reader: ChunkReader = response.body!.getReader();

    // Not `readEvent`: the greeting is a comment, which that helper skips.
    expect(await readChunk(reader)).toContain(": connected");

    // chokidar needs a moment to arm its watchers before the write lands.
    await Bun.sleep(300);
    writeFileSync(join(root, "Home.md"), "# Home\n\nedited\n");

    expect(await readEvent(reader)).toContain("event: file_changed");
    await reader.cancel();
  }, 15_000);

  // A repository nobody vouched for may link back to one of its own parents.
  // Following it walks until the kernel answers ELOOP, and that error reaching
  // chokidar unhandled used to kill the process moments after it started
  // listening — the wiki never became readable at all.
  test("keeps serving a wiki whose symlink points at an ancestor", async () => {
    const cyclic = createWiki({ "wiki/Home.md": "# Home\n" });
    symlinkSync(cyclic, join(cyclic, "wiki", "linked"));

    const context = await resolveWikiContext(join(cyclic, "wiki"));
    const cyclicServer = await startMdivServer(context, "localhost", 0);
    try {
      await Bun.sleep(500);
      const response = await fetch(`${cyclicServer.url}api/tree`);
      expect(response.status).toBe(200);
      expect(((await response.json()) as TreeResponse).files).toEqual(["Home.md"]);
    } finally {
      await cyclicServer.stop();
    }
  }, 15_000);
});

async function readChunk(reader: ChunkReader): Promise<string> {
  const result = await reader.read();
  if (result.done) {
    throw new Error("stream closed before anything arrived");
  }
  return new TextDecoder().decode(result.value);
}

/** Skips the keep-alive comments the hub sends between real events. */
async function readEvent(reader: ChunkReader): Promise<string> {
  const decoder = new TextDecoder();
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    // A stream is read one chunk at a time; there is nothing to parallelize.
    // oxlint-disable-next-line no-await-in-loop
    const result = await reader.read();
    if (result.done) {
      throw new Error("stream closed before an event arrived");
    }
    const text = decoder.decode(result.value);
    if (text.includes("event: ")) {
      return text;
    }
  }

  throw new Error("timed out waiting for an event");
}
