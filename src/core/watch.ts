import { watch } from "chokidar";
import { realpathSync } from "node:fs";
import { isAbsolute, relative } from "node:path";
import { isIgnoredSegment } from "./ignore.ts";
import { isMarkdownPath } from "./path.ts";

export type WikiChangeEvent = "tree_changed" | "file_changed";

export type WikiWatcher = {
  close: () => Promise<void>;
};

export type WatchFactory = (
  rootDir: string,
  onChange: (event: WikiChangeEvent) => void,
) => WikiWatcher;

/** Dot-prefixed paths are noise, except the ones the wiki itself relies on. */
const WATCHED_DOT_ENTRIES = new Set([".attachments", ".order"]);

export function watchWiki(
  rootDir: string,
  onChange: (event: WikiChangeEvent) => void,
): WikiWatcher {
  const bases = watchBases(rootDir);
  const watcher = watch(rootDir, {
    ignoreInitial: true,
    // The wiki may be a repository nobody vouched for. Following its symlinks
    // would watch directories the server refuses to serve, and a link back to
    // an ancestor walks until the kernel gives up with ELOOP — which arrives
    // here as an unhandled error and takes the whole process down at startup.
    followSymlinks: false,
    ignored: (path) => shouldIgnore(toWatchRelativePath(bases, path)),
  });

  watcher.on("all", (event, path) => {
    const change = classifyChange(event, path);
    if (change) {
      onChange(change);
    }
  });

  // Losing file watching degrades mdiv to manual reloads; it must not end it.
  watcher.on("error", (error) => {
    console.error("mdiv: file watcher error", error);
  });

  return { close: () => watcher.close() };
}

/**
 * On macOS a wiki under `/tmp` is reported by the watcher as `/private/tmp`,
 * so a single base would make every relative path start with `..` and get
 * ignored as a dot-prefixed segment. Both spellings are accepted.
 */
export function watchBases(rootDir: string): string[] {
  try {
    const real = realpathSync(rootDir);
    return real === rootDir ? [rootDir] : [rootDir, real];
  } catch {
    return [rootDir];
  }
}

/** Relative path from whichever base contains `absolutePath`. */
export function toWatchRelativePath(bases: string[], absolutePath: string): string {
  for (const base of bases) {
    const relativePath = relative(base, absolutePath);
    if (!relativePath.startsWith("..") && !isAbsolute(relativePath)) {
      return relativePath;
    }
  }
  // Unrecognised base: report it rather than silently dropping the event.
  return "";
}

export function shouldIgnore(relativePath: string): boolean {
  return relativePath
    .replaceAll("\\", "/")
    .split("/")
    .some(
      (part) => isIgnoredSegment(part) || (part.startsWith(".") && !WATCHED_DOT_ENTRIES.has(part)),
    );
}

export function classifyChange(event: string, path: string): WikiChangeEvent | null {
  switch (event) {
    case "add":
      return isMarkdownPath(path) ? "tree_changed" : "file_changed";
    case "change":
      return path.endsWith(".order") ? "tree_changed" : "file_changed";
    case "unlink":
    case "addDir":
    case "unlinkDir":
      return "tree_changed";
    default:
      return null;
  }
}
