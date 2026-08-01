import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/server/handler.ts";
import { adoFlavor } from "../../src/flavors/ado/index.ts";
import type { RenderResponse, TreeResponse } from "../../src/types.ts";
import { createWiki, wikiContext } from "../helpers/wiki.ts";

function appFor(files: Record<string, string>) {
  const root = createWiki(files);
  return {
    root,
    app: createApp(wikiContext(root, adoFlavor, { initialPagePath: "Home.md", mode: "file" })),
  };
}

describe("HTTP API", () => {
  test("serves the tree with the resolved flavor", async () => {
    const { app } = appFor({ "Home.md": "# Home\n" });
    const tree = (await (
      await app.fetch(new Request("http://localhost/api/tree"))
    ).json()) as TreeResponse;

    expect(tree.flavor).toBe("ado");
    expect(tree.initialPagePath).toBe("Home.md");
    expect(tree.files).toEqual(["Home.md"]);
  });

  test("renders a page", async () => {
    const { app } = appFor({ "Home.md": "# Home\n\n![x](.attachments/x.txt)\n" });
    const render = (await (
      await app.fetch(new Request("http://localhost/api/render?path=Home.md"))
    ).json()) as RenderResponse;

    expect(render.html).toContain('<h1 id="home">');
    expect(render.headings).toEqual([{ id: "home", text: "Home", level: 1 }]);
  });

  test("serves attachments", async () => {
    const { app } = appFor({ "Home.md": "# Home\n", ".attachments/x.txt": "asset" });
    const response = await app.fetch(
      new Request("http://localhost/api/asset?path=.attachments%2Fx.txt"),
    );

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("asset");
  });

  describe("error statuses", () => {
    test("rejects paths that escape the wiki root with 400", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(
        new Request("http://localhost/api/asset?path=..%2Fsecret.txt"),
      );
      expect(response.status).toBe(400);
    });

    test("answers 404 for a safe path that does not exist", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      expect(
        (await app.fetch(new Request("http://localhost/api/asset?path=missing.png"))).status,
      ).toBe(404);
      expect(
        (await app.fetch(new Request("http://localhost/api/render?path=Missing.md"))).status,
      ).toBe(404);
    });

    test("rejects a missing path parameter and non-Markdown render targets with 400", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      expect((await app.fetch(new Request("http://localhost/api/asset"))).status).toBe(400);
      expect(
        (await app.fetch(new Request("http://localhost/api/render?path=Home.txt"))).status,
      ).toBe(400);
    });

    test("answers 404 for unknown routes", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      expect((await app.fetch(new Request("http://localhost/nope"))).status).toBe(404);
    });
  });

  describe("server-sent events", () => {
    test("the handler and the hub share one client registry", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(new Request("http://localhost/api/events"));
      expect(response.headers.get("Content-Type")).toContain("text/event-stream");

      const reader = response.body?.getReader();
      expect(decode(await reader?.read())).toContain("event: tree_changed");

      // The old handler kept its own Set, so a watcher event never reached a
      // client that had connected through the request handler.
      expect(app.hub.size).toBe(1);
      app.hub.emit("file_changed");
      expect(decode(await reader?.read())).toContain("event: file_changed");

      await reader?.cancel();
    });
  });
});

function decode(result: { value?: Uint8Array } | undefined): string {
  return new TextDecoder().decode(result?.value);
}
