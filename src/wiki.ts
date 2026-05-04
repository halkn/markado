import { readdirSync, readFileSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { isMarkdownPath, stripMarkdownExtension, toPosixPath } from "./path.ts";
import type { TreeNode, TreeResponse, WikiContext } from "./types.ts";

type DirEntry = {
  name: string;
  absolutePath: string;
  isDirectory: boolean;
  isFile: boolean;
};

export async function resolveWikiContext(targetPath: string | undefined): Promise<WikiContext> {
  const target = resolve(targetPath ?? ".");
  const stat = await Bun.file(target).stat();

  if (stat.isDirectory()) {
    return { rootDir: target, initialPagePath: null, mode: "tree" };
  }

  if (!stat.isFile() || !isMarkdownPath(target)) {
    throw new Error("Path must be a Markdown file or directory");
  }

  return {
    rootDir: dirname(target),
    initialPagePath: basename(target),
    mode: "file",
  };
}

export function scanWiki(context: WikiContext): TreeResponse {
  const root = scanDirectory(context.rootDir, context.rootDir, basename(context.rootDir));
  const files: string[] = [];
  collectFiles(root, files);

  return {
    mode: context.mode,
    initialPagePath: context.initialPagePath ?? files[0] ?? null,
    root,
    files,
  };
}

function scanDirectory(rootDir: string, absoluteDir: string, displayName: string): TreeNode {
  const entries = safeReadDir(absoluteDir);
  const markdownFiles = entries.filter((entry) => entry.isFile && isMarkdownPath(entry.name));
  const visibleDirs = entries.filter(
    (entry) => entry.isDirectory && isVisibleTreeDirectory(entry.name),
  );
  const dirsByLowerName = new Map(visibleDirs.map((entry) => [entry.name.toLowerCase(), entry]));
  const nodes: TreeNode[] = [];

  for (const file of markdownFiles) {
    const pageName = stripMarkdownExtension(file.name);
    const pageFolder = dirsByLowerName.get(pageName.toLowerCase());
    nodes.push({
      name: pageName,
      path: relativeMarkdownPath(rootDir, file.absolutePath),
      kind: "file",
      children: pageFolder
        ? scanDirectory(rootDir, pageFolder.absolutePath, pageFolder.name).children
        : [],
    });
  }

  for (const dir of visibleDirs) {
    const hasPageFile = markdownFiles.some(
      (file) => stripMarkdownExtension(file.name).toLowerCase() === dir.name.toLowerCase(),
    );
    if (!hasPageFile) {
      nodes.push(scanDirectory(rootDir, dir.absolutePath, dir.name));
    }
  }

  nodes.sort(compareByOrder(readOrder(absoluteDir)));

  return {
    name: displayName,
    path: null,
    kind: "dir",
    children: nodes,
  };
}

function safeReadDir(absoluteDir: string): DirEntry[] {
  return readdirSync(absoluteDir)
    .map((name) => {
      const absolutePath = join(absoluteDir, name);
      const stat = statSync(absolutePath);
      return {
        name,
        absolutePath,
        isDirectory: stat.isDirectory(),
        isFile: stat.isFile(),
      };
    })
    .filter((entry) => entry.isDirectory || entry.isFile);
}

function isVisibleTreeDirectory(name: string): boolean {
  return !name.startsWith(".");
}

function relativeMarkdownPath(rootDir: string, absolutePath: string): string {
  return toPosixPath(relative(rootDir, absolutePath));
}

function readOrder(absoluteDir: string): Map<string, number> {
  const order = new Map<string, number>();
  try {
    const lines = readFileSync(join(absoluteDir, ".order"), "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const key = stripMarkdownExtension(trimmed).toLowerCase();
      if (!order.has(key)) {
        order.set(key, order.size);
      }
    }
  } catch {
    return order;
  }
  return order;
}

function compareByOrder(order: Map<string, number>): (left: TreeNode, right: TreeNode) => number {
  return (left, right) => {
    const leftOrder = order.get(left.name.toLowerCase());
    const rightOrder = order.get(right.name.toLowerCase());
    if (leftOrder !== undefined && rightOrder !== undefined) {
      return leftOrder - rightOrder;
    }
    if (leftOrder !== undefined) {
      return -1;
    }
    if (rightOrder !== undefined) {
      return 1;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  };
}

function collectFiles(node: TreeNode, files: string[]): void {
  if (node.kind === "file" && node.path) {
    files.push(node.path);
  }
  for (const child of node.children) {
    collectFiles(child, files);
  }
}
