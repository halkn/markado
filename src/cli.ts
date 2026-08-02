#!/usr/bin/env bun
import { Command } from "commander";
import { spawn } from "node:child_process";
import { resolveWikiContext } from "./core/context.ts";
import { toReadUrl } from "./core/readUrl.ts";
import { FLAVOR_SELECTIONS, isFlavorSelection } from "./flavors/registry.ts";
import { assertBindAllowed, isLoopbackAddress, startMdivServer } from "./server/index.ts";
import { VERSION } from "./version.ts";

type CliOptions = {
  port: string;
  bind: string;
  open: boolean;
  flavor: string;
  allowRemoteAccess: boolean;
  allowRemoteImages: boolean;
};

const program = new Command()
  .name("mdiv")
  .description("Preview local Markdown in the browser")
  .version(VERSION)
  .argument("[path]", "Markdown file or wiki directory")
  .option("--port <number>", "server port", "6275")
  .option("--bind <address>", "bind address", "127.0.0.1")
  .option("--flavor <name>", `wiki flavor (${FLAVOR_SELECTIONS.join("|")})`, "auto")
  .option("--allow-remote-access", "permit binding to an address other than loopback")
  .option("--allow-remote-images", "let documents load images from the network")
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
assertBindAllowed(options.bind, options.allowRemoteAccess);

const context = await resolveWikiContext(targetPath, options.flavor);
const server = await startMdivServer(context, options.bind, port, {
  allowRemoteImages: options.allowRemoteImages,
});
const previewUrl = context.initialPagePath
  ? new URL(toReadUrl(context.initialPagePath), server.url).href
  : server.url;

console.log(`mdiv serving ${context.rootDir} (${context.flavor.name})`);
console.log(`listening on ${options.bind}:${port}`);
console.log(previewUrl);

if (!isLoopbackAddress(options.bind)) {
  console.error(
    `\nmdiv is reachable from the network on ${options.bind}:${port}.\n` +
      "Anyone who can reach that port can read every file under the wiki root,\n" +
      "and requests arriving under any hostname are answered.\n",
  );
}

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
