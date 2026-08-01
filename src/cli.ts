#!/usr/bin/env bun
import { Command } from "commander";
import { spawn } from "node:child_process";
import { resolveWikiContext } from "./core/context.ts";
import { toReadUrl } from "./core/readUrl.ts";
import { FLAVOR_SELECTIONS, isFlavorSelection } from "./flavors/registry.ts";
import { startMdivServer } from "./server/index.ts";
import { VERSION } from "./version.ts";

type CliOptions = {
  port: string;
  bind: string;
  open: boolean;
  flavor: string;
};

const program = new Command()
  .name("mdiv")
  .description("Preview local Markdown in the browser")
  .version(VERSION)
  .argument("[path]", "Markdown file or wiki directory")
  .option("--port <number>", "server port", "6275")
  .option("--bind <address>", "bind address", "localhost")
  .option("--flavor <name>", `wiki flavor (${FLAVOR_SELECTIONS.join("|")})`, "auto")
  .option("--no-open", "do not open a browser");

program.parse();

const options = program.opts<CliOptions>();
const targetPath = program.args[0];
const port = Number.parseInt(options.port, 10);
if (!Number.isInteger(port) || port <= 0 || port > 65535) {
  throw new Error("--port must be a valid TCP port");
}
if (!isFlavorSelection(options.flavor)) {
  throw new Error(`--flavor must be one of ${FLAVOR_SELECTIONS.join(", ")}`);
}

const context = await resolveWikiContext(targetPath, options.flavor);
const server = await startMdivServer(context, options.bind, port);
const previewUrl = context.initialPagePath
  ? new URL(toReadUrl(context.initialPagePath), server.url).href
  : server.url;

console.log(`mdiv serving ${context.rootDir} (${context.flavor.name})`);
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
