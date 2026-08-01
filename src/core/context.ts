import { basename, dirname, resolve } from "node:path";
import { resolveFlavor, type FlavorSelection } from "../flavors/registry.ts";
import type { WikiContext } from "../types.ts";
import { isMarkdownPath } from "./path.ts";

export async function resolveWikiContext(
  targetPath: string | undefined,
  flavorSelection: FlavorSelection = "auto",
): Promise<WikiContext> {
  const target = resolve(targetPath ?? ".");
  const stats = await Bun.file(target).stat();

  if (stats.isDirectory()) {
    return {
      rootDir: target,
      initialPagePath: null,
      mode: "tree",
      flavor: await resolveFlavor(target, flavorSelection),
    };
  }

  if (!stats.isFile() || !isMarkdownPath(target)) {
    throw new Error("Path must be a Markdown file or directory");
  }

  const rootDir = dirname(target);
  return {
    rootDir,
    initialPagePath: basename(target),
    mode: "file",
    flavor: await resolveFlavor(rootDir, flavorSelection),
  };
}
