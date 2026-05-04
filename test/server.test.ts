import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequestHandler } from "../src/server.ts";

describe("HTTP API", () => {
  test("serves tree, render, asset, and SSE responses", async () => {
    const root = mkdtempSync(join(tmpdir(), "markado-api-"));
    writeFileSync(join(root, "Home.md"), "# Home\n\n![x](.attachments/x.txt)\n");
    mkdirSync(join(root, ".attachments"));
    writeFileSync(join(root, ".attachments", "x.txt"), "asset");
    const handler = createRequestHandler({
      rootDir: root,
      initialPagePath: "Home.md",
      mode: "file",
    });

    const tree = await (await handler(new Request("http://localhost/api/tree"))).json();
    expect(tree.initialPagePath).toBe("Home.md");

    const render = await (
      await handler(new Request("http://localhost/api/render?path=Home.md"))
    ).json();
    expect(render.html).toContain("<h1");

    const asset = await handler(
      new Request("http://localhost/api/asset?path=.attachments%2Fx.txt"),
    );
    expect(await asset.text()).toBe("asset");

    const escaped = await handler(new Request("http://localhost/api/asset?path=..%2Fsecret.txt"));
    expect(escaped.status).toBe(400);

    const events = await handler(new Request("http://localhost/api/events"));
    expect(events.headers.get("Content-Type")).toContain("text/event-stream");
    const reader = events.body?.getReader();
    const chunk = await reader?.read();
    expect(new TextDecoder().decode(chunk?.value)).toContain("event: tree_changed");
    await reader?.cancel();
  });
});
