import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { createMemoryHistory, RouterProvider } from "@tanstack/react-router";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { RenderResponse, TreeResponse } from "../../../src/types.ts";
import { createAppRouter } from "../../../src/web/app/router.tsx";

const tree: TreeResponse = {
  flavor: "plain",
  mode: "tree",
  initialPagePath: "Home.md",
  root: {
    name: "wiki",
    path: null,
    kind: "dir",
    children: [
      { name: "Home", path: "Home.md", kind: "file", children: [] },
      { name: "設計 メモ", path: "docs/設計 メモ.md", kind: "file", children: [] },
    ],
  },
  files: ["Home.md", "docs/設計 メモ.md"],
};

const pages: Record<string, RenderResponse> = {
  "Home.md": {
    path: "Home.md",
    title: "Home",
    html: '<h1 id="home">Home</h1>',
    headings: [{ id: "home", text: "Home", level: 1 }],
  },
  "docs/設計 メモ.md": {
    path: "docs/設計 メモ.md",
    title: "設計メモ",
    html: '<h1 id="design">設計メモ</h1>',
    headings: [{ id: "design", text: "設計メモ", level: 1 }],
  },
};

const originalFetch = globalThis.fetch;

beforeEach(() => {
  localStorage.clear();
  // The shell also opens an EventSource; happy-dom leaves it unconnected.
  globalThis.fetch = ((input: string | URL | Request) => {
    const url = new URL(String(input instanceof Request ? input.url : input), "http://localhost");
    if (url.pathname === "/api/tree") {
      return jsonResponse(tree);
    }
    const page = pages[url.searchParams.get("path") ?? ""];
    return page ? jsonResponse(page) : Promise.resolve(new Response("Not found", { status: 404 }));
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function jsonResponse(value: unknown): Promise<Response> {
  return Promise.resolve(
    new Response(JSON.stringify(value), { headers: { "Content-Type": "application/json" } }),
  );
}

function renderShell(initialUrl: string) {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [initialUrl] }));
  render(<RouterProvider router={router} />);
  return router;
}

describe("AppShell", () => {
  test("opens the first page when the URL names none", async () => {
    const router = renderShell("/");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Home" })).toBeTruthy());
    expect(router.state.location.pathname).toBe("/read/Home.md");
  });

  test("renders the page named by the URL, including non-ASCII paths", async () => {
    renderShell(`/read/docs/${encodeURIComponent("設計 メモ.md")}`);

    await waitFor(() => expect(screen.getByRole("heading", { name: "設計メモ" })).toBeTruthy());
  });

  test("moving through the tree updates the URL", async () => {
    const router = renderShell("/read/Home.md");

    const link = await screen.findByText("設計 メモ");
    fireEvent.click(link);

    // The router keeps the path decoded; the browser is what percent-encodes it
    // in the address bar.
    await waitFor(() => expect(router.state.location.pathname).toBe("/read/docs/設計 メモ.md"));
  });

  test("shows the outline of the open page", async () => {
    renderShell("/read/Home.md");

    const outline = await screen.findByRole("navigation", { name: "On this page" });
    expect(outline.textContent).toContain("Home");
  });

  test("reports a page that cannot be read", async () => {
    renderShell("/read/missing.md");

    await waitFor(() => expect(screen.getByText("Not found")).toBeTruthy());
  });

  // Collapsing itself is driven by measured pane sizes, which happy-dom never
  // produces, so only the control is asserted here. Resizing, collapsing, and
  // the persistence of both are verified in a real browser.
  test("offers a control for each side pane", async () => {
    renderShell("/read/Home.md");

    expect(await screen.findByRole("button", { name: "ファイルペインを閉じる" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "アウトラインを閉じる" })).toBeTruthy();
  });
});
