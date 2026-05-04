#!/usr/bin/env bun
import { Command } from "commander";
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { startMarkadoServer } from "./server.ts";
import { resolveWikiContext } from "./wiki.ts";

type CliOptions = {
  port: string;
  bind: string;
  open: boolean;
};

const packageJson = JSON.parse(readFileSync(join(import.meta.dir, "../package.json"), "utf8")) as {
  version: string;
};

const program = new Command()
  .name("markado")
  .description("Preview a local Markdown wiki in the browser")
  .version(packageJson.version)
  .argument("[path]", "Markdown file or wiki directory")
  .option("--port <number>", "server port", "6275")
  .option("--bind <address>", "bind address", "localhost")
  .option("--no-open", "do not open a browser");

program.parse();

const options = program.opts<CliOptions>();
const targetPath = program.args[0];
const port = Number.parseInt(options.port, 10);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("--port must be a valid TCP port");
}

const context = await resolveWikiContext(targetPath);
const server = await startMarkadoServer(context, options.bind, port);
const previewUrl = context.initialPagePath
  ? `${server.url}?path=${encodeURIComponent(context.initialPagePath)}`
  : server.url;

console.log(`markado serving ${context.rootDir}`);
console.log(previewUrl);

if (options.open) {
  openBrowser(previewUrl);
}

const shutdown = async () => {
  await server.stop();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

function openBrowser(targetUrl: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", targetUrl] : [targetUrl];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
