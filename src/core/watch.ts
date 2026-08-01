import { watch } from "chokidar";
import { relative } from "node:path";
import { isMarkdownPath } from "./path.ts";

export type WikiChangeEvent = "tree_changed" | "file_changed";

export type WikiWatcher = {
  close: () => Promise<void>;
};

/** Dot-prefixed paths are noise, except the ones the wiki itself relies on. */
const WATCHED_DOT_ENTRIES = new Set([".attachments", ".order"]);

export function watchWiki(
  rootDir: string,
  onChange: (event: WikiChangeEvent) => void,
): WikiWatcher {
  const watcher = watch(rootDir, {
    ignoreInitial: true,
    ignored: (path) => shouldIgnore(relative(rootDir, path)),
  });

  watcher.on("add", (path) => onChange(isMarkdownPath(path) ? "tree_changed" : "file_changed"));
  watcher.on("unlink", () => onChange("tree_changed"));
  watcher.on("addDir", () => onChange("tree_changed"));
  watcher.on("unlinkDir", () => onChange("tree_changed"));
  watcher.on("change", (path) =>
    onChange(path.endsWith(".order") ? "tree_changed" : "file_changed"),
  );

  return { close: () => watcher.close() };
}

export function shouldIgnore(relativePath: string): boolean {
  return relativePath
    .replaceAll("\\", "/")
    .split("/")
    .some((part) => part.startsWith(".") && !WATCHED_DOT_ENTRIES.has(part));
}
