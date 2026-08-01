import { readdir, realpath, stat } from "node:fs/promises";
import type { Dirent } from "node:fs";
import { basename, join, relative } from "node:path";
import type { DirEntry, EntryGroup, EntryGroupComparator, Flavor } from "../flavors/types.ts";
import type { TreeNode, TreeResponse, WikiContext } from "../types.ts";
import { isIgnoredSegment } from "./ignore.ts";
import { isMarkdownPath, stripMarkdownExtension, toPosixPath } from "./path.ts";

/** Guards against pathological nesting; deeper trees are truncated, not fatal. */
const MAX_DEPTH = 32;

export async function scanWiki(context: WikiContext): Promise<TreeResponse> {
  const visited = new Set<string>([await realpath(context.rootDir)]);
  const children = await buildNodes(context.rootDir, context.rootDir, context.flavor, 0, visited);
  const root: TreeNode = {
    name: basename(context.rootDir),
    path: null,
    kind: "dir",
    children,
  };

  const files: string[] = [];
  collectFiles(root, files);

  return {
    flavor: context.flavor.name,
    mode: context.mode,
    initialPagePath: context.initialPagePath ?? files[0] ?? null,
    root,
    files,
  };
}

/** Default grouping: Markdown files and directories become separate nodes. */
export function defaultGroupEntries(entries: DirEntry[]): EntryGroup[] {
  const groups: EntryGroup[] = [];

  for (const entry of entries) {
    if (entry.kind === "dir") {
      groups.push({ name: entry.name, file: null, dir: entry });
    } else if (isMarkdownPath(entry.name)) {
      groups.push({ name: stripMarkdownExtension(entry.name), file: entry, dir: null });
    }
  }

  return groups;
}

export const compareByName: EntryGroupComparator = (left, right) =>
  left.name.localeCompare(right.name, undefined, { sensitivity: "base" });

async function buildNodes(
  rootDir: string,
  absoluteDir: string,
  flavor: Flavor,
  depth: number,
  visited: Set<string>,
): Promise<TreeNode[]> {
  if (depth > MAX_DEPTH) {
    return [];
  }

  const entries = (await readEntries(rootDir, absoluteDir)).filter(
    (entry) => !isHiddenEntry(entry) && !flavor.excludeFromTree?.(entry),
  );
  const groups = (flavor.groupEntries ?? defaultGroupEntries)(entries);
  const comparator = (await flavor.createComparator?.(absoluteDir)) ?? compareByName;
  const nodes: TreeNode[] = [];

  for (const group of groups.toSorted(comparator)) {
    // Sequential on purpose: `visited` must be updated before the next sibling
    // is considered, otherwise a symlinked directory is traversed twice.
    // oxlint-disable-next-line no-await-in-loop
    const children = group.dir ? await descend(rootDir, group.dir, flavor, depth + 1, visited) : [];

    nodes.push({
      name: group.name,
      path: group.file?.relativePath ?? null,
      kind: group.file ? "file" : "dir",
      children,
    });
  }

  return nodes;
}

/** Recurses into a directory unless a symlink already led us through it. */
async function descend(
  rootDir: string,
  dir: DirEntry,
  flavor: Flavor,
  depth: number,
  visited: Set<string>,
): Promise<TreeNode[]> {
  let realDir: string;
  try {
    realDir = await realpath(dir.absolutePath);
  } catch {
    return [];
  }

  if (visited.has(realDir)) {
    return [];
  }

  visited.add(realDir);
  return buildNodes(rootDir, dir.absolutePath, flavor, depth, visited);
}

async function readEntries(rootDir: string, absoluteDir: string): Promise<DirEntry[]> {
  let dirents: Dirent[];
  try {
    dirents = await readdir(absoluteDir, { withFileTypes: true });
  } catch {
    return [];
  }

  const entries = await Promise.all(
    dirents.map(async (dirent): Promise<DirEntry | null> => {
      const absolutePath = join(absoluteDir, dirent.name);
      const kind = await entryKind(dirent, absolutePath);
      return kind
        ? {
            name: dirent.name,
            relativePath: toPosixPath(relative(rootDir, absolutePath)),
            absolutePath,
            kind,
          }
        : null;
    }),
  );

  return entries.filter((entry): entry is DirEntry => entry !== null);
}

async function entryKind(dirent: Dirent, absolutePath: string): Promise<DirEntry["kind"] | null> {
  if (dirent.isDirectory()) {
    return "dir";
  }
  if (dirent.isFile()) {
    return "file";
  }
  if (!dirent.isSymbolicLink()) {
    return null;
  }

  try {
    const stats = await stat(absolutePath);
    return stats.isDirectory() ? "dir" : stats.isFile() ? "file" : null;
  } catch {
    return null;
  }
}

function isHiddenEntry(entry: DirEntry): boolean {
  return entry.name.startsWith(".") || isIgnoredSegment(entry.name);
}

function collectFiles(node: TreeNode, files: string[]): void {
  if (node.kind === "file" && node.path) {
    files.push(node.path);
  }
  for (const child of node.children) {
    collectFiles(child, files);
  }
}
