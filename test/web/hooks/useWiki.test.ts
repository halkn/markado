import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { RenderResponse, TreeResponse } from "../../../src/types.ts";
import { useWiki } from "../../../src/web/app/hooks/useWiki.ts";

const tree: TreeResponse = {
  flavor: "plain",
  mode: "tree",
  initialPagePath: "Home.md",
  root: { name: "wiki", path: null, kind: "dir", children: [] },
  files: ["Home.md"],
};

let page: RenderResponse = {
  path: "Home.md",
  title: "Home",
  html: "<h1>Home</h1>",
  headings: [],
};

/** Captures the listeners the hook registers, so a change can be replayed. */
type FakeEventSource = { fire: (event: string) => void };
let sources: FakeEventSource[] = [];

const originalFetch = globalThis.fetch;
const originalEventSource = globalThis.EventSource;

beforeEach(() => {
  sources = [];
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost");
    const body = url.pathname === "/api/tree" ? tree : page;
    return Promise.resolve(
      new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } }),
    );
  }) as typeof fetch;

  globalThis.EventSource = class {
    private readonly listeners = new Map<string, () => void>();

    constructor() {
      sources.push({ fire: (event) => this.listeners.get(event)?.() });
    }

    addEventListener(event: string, listener: () => void): void {
      this.listeners.set(event, listener);
    }

    close(): void {}
  } as unknown as typeof EventSource;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  globalThis.EventSource = originalEventSource;
});

/** Every status the hook has rendered, so a momentary flash is visible too. */
function trackStatuses(): { statuses: string[]; wiki: () => ReturnType<typeof useWiki> } {
  const statuses: string[] = [];
  const { result } = renderHook(() => {
    const wiki = useWiki("Home.md");
    statuses.push(`page:${wiki.page?.status ?? "none"} tree:${wiki.tree.status}`);
    return wiki;
  });
  return { statuses, wiki: () => result.current };
}

describe("useWiki", () => {
  // The bug this guards: a reload dropped the page back to `loading`, which
  // unmounted the document and threw away the diagrams rendered into it.
  test("keeps the loaded page on screen while it reloads", async () => {
    const { statuses, wiki } = trackStatuses();
    await waitFor(() => expect(wiki().page?.status).toBe("ready"));

    page = { ...page, html: "<h1>Home</h1><p>edited</p>" };
    statuses.length = 0;
    await act(async () => {
      sources.at(-1)?.fire("file_changed");
    });

    expect(statuses.join("|")).not.toContain("page:loading");
    expect(wiki().page).toEqual({ status: "ready", value: page });
  });

  test("keeps the loaded tree on screen while it reloads", async () => {
    const { statuses, wiki } = trackStatuses();
    await waitFor(() => expect(wiki().tree.status).toBe("ready"));

    statuses.length = 0;
    await act(async () => {
      sources.at(-1)?.fire("tree_changed");
    });

    expect(statuses.join("|")).not.toContain("tree:loading");
  });

  test("shows the loading state when the page has never been loaded", async () => {
    const { wiki } = trackStatuses();

    expect(wiki().page?.status).toBe("loading");

    // Let the requests this mount started settle inside the test, or React
    // reports the state update as happening outside `act`.
    await act(async () => {});
  });
});
