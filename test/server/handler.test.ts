import { describe, expect, test } from "bun:test";
import { mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createApp } from "../../src/server/handler.ts";
import { errorResponse } from "../../src/server/http.ts";
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

    test("answers 404 for unknown API routes", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      expect((await app.fetch(new Request("http://localhost/api/nope"))).status).toBe(404);
    });

    test("rejects traversal on the render route too", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      expect(
        (await app.fetch(new Request("http://localhost/api/render?path=..%2Fsecret.md"))).status,
      ).toBe(400);
    });

    test("answers 400 for a symlink out of the root, present or not", async () => {
      const root = createWiki({ "Home.md": "# Home\n" });
      const outside = mkdtempSync(join(tmpdir(), "mdiv-outside-"));
      writeFileSync(join(outside, "secret.txt"), "secret");
      symlinkSync(outside, join(root, "linked"));
      const app = createApp(wikiContext(root, adoFlavor));

      // Both have to answer alike: a 404 for the missing one would confirm that
      // the other exists, outside the root, without ever serving it.
      const statuses = await Promise.all(
        ["linked%2Fsecret.txt", "linked%2Fabsent.txt"].map(async (path) => {
          const response = await app.fetch(new Request(`http://localhost/api/asset?path=${path}`));
          return response.status;
        }),
      );
      expect(statuses).toEqual([400, 400]);
    });

    test("keeps filesystem paths out of an unexpected failure", async () => {
      // Node quotes the absolute path it failed on in every fs error, and those
      // errors reach the catch-all. Only the deliberate statuses may say more.
      const leaky = new Error("ENOENT: no such file or directory, open '/home/me/wiki/secret.md'");
      const response = errorResponse(leaky);

      expect(response.status).toBe(500);
      expect(await response.text()).toBe("Internal server error");
    });
  });

  describe("request policy", () => {
    test("refuses anything but a read", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(
        new Request("http://localhost/api/tree", { method: "POST" }),
      );
      expect(response.status).toBe(405);
    });

    test("refuses a cross-origin request", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(
        new Request("http://localhost/api/tree", { headers: { Origin: "https://evil.example" } }),
      );
      expect(response.status).toBe(403);
    });

    test("refuses a rebound hostname while the server is on loopback", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      // DNS rebinding needs a name the attacker controls to resolve to 127.0.0.1.
      const response = await app.fetch(
        new Request("http://localhost/api/tree", { headers: { Host: "evil.example" } }),
      );
      expect(response.status).toBe(403);
    });

    test("accepts any hostname once the bind is explicitly remote", async () => {
      const root = createWiki({ "Home.md": "# Home\n" });
      const app = createApp(wikiContext(root, adoFlavor), {
        bind: "0.0.0.0",
        allowRemoteImages: false,
      });
      const response = await app.fetch(
        new Request("http://localhost/api/tree", { headers: { Host: "wiki.example" } }),
      );
      expect(response.status).toBe(200);
    });
  });

  describe("security headers", () => {
    test("locks the shell down to its own origin", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const csp =
        (await app.fetch(new Request("http://localhost/read/Home.md"))).headers.get(
          "Content-Security-Policy",
        ) ?? "";

      expect(csp).toContain("script-src 'self'");
      expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(csp).toContain("img-src 'self' data:;");
    });

    test("opens img-src only when the reader asks for it", async () => {
      const root = createWiki({ "Home.md": "# Home\n" });
      const app = createApp(wikiContext(root, adoFlavor), {
        bind: "127.0.0.1",
        allowRemoteImages: true,
      });
      const csp =
        (await app.fetch(new Request("http://localhost/"))).headers.get(
          "Content-Security-Policy",
        ) ?? "";

      expect(csp).toContain("img-src 'self' data: https:");
    });

    test("sandboxes assets so a wiki-local SVG cannot script", async () => {
      const { app } = appFor({ "Home.md": "# Home\n", "diagram.svg": "<svg></svg>" });
      const response = await app.fetch(new Request("http://localhost/api/asset?path=diagram.svg"));

      expect(response.headers.get("Content-Security-Policy")).toContain("sandbox");
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    });

    test("sets the common headers on API responses", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(new Request("http://localhost/api/tree"));

      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(response.headers.get("Referrer-Policy")).toBe("no-referrer");
      expect(response.headers.get("Content-Security-Policy")).toContain("default-src 'none'");
    });
  });

  describe("single page app shell", () => {
    test("serves the shell for the root and for page URLs", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });

      const responses = await Promise.all(
        ["/", "/read/Home.md", "/read/docs/deep/page.md"].map((path) =>
          app.fetch(new Request(`http://localhost${path}`)),
        ),
      );

      for (const response of responses) {
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toContain("text/html");
      }
    });

    // A browser that cached an older shell asks for a bundle filename that no
    // longer exists. Answering with the shell hands it HTML where it expects a
    // module, which fails silently and leaves the page blank.
    test("answers 404 for an asset that is not in the bundle", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(new Request("http://localhost/assets/stale-x1.js"));

      expect(response.status).toBe(404);
    });

    test("keeps the shell out of the browser cache", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(new Request("http://localhost/read/Home.md"));

      expect(response.headers.get("Cache-Control")).toBe("no-store");
    });
  });

  describe("server-sent events", () => {
    test("the handler and the hub share one client registry", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(new Request("http://localhost/api/events"));
      expect(response.headers.get("Content-Type")).toContain("text/event-stream");

      const reader = response.body?.getReader();
      expect(decode(await reader?.read())).toBe(": connected\n\n");

      // The old handler kept its own Set, so a watcher event never reached a
      // client that had connected through the request handler.
      expect(app.hub.size).toBe(1);
      app.hub.emit("file_changed");
      expect(decode(await reader?.read())).toContain("event: file_changed");

      await reader?.cancel();
    });

    // The bug this guards: connecting greeted the client with `tree_changed`,
    // so every reconnect looked like a file edit and reloaded the whole view.
    test("opening the stream is not a change event", async () => {
      const { app } = appFor({ "Home.md": "# Home\n" });
      const response = await app.fetch(new Request("http://localhost/api/events"));

      const reader = response.body?.getReader();
      expect(decode(await reader?.read())).not.toContain("event:");

      await reader?.cancel();
    });
  });
});

function decode(result: { value?: Uint8Array } | undefined): string {
  return new TextDecoder().decode(result?.value);
}
