import { isMarkdownPath, stripMarkdownExtension } from "../../core/path.ts";
import type { DirEntry, EntryGroup } from "../types.ts";

/**
 * Azure DevOps Wiki represents a page with children as `Guide.md` plus a
 * sibling `Guide/` folder. They are merged into one clickable node so the tree
 * matches what the wiki shows.
 */
export function groupPageFolders(entries: DirEntry[]): EntryGroup[] {
  const files = entries.filter((entry) => entry.kind === "file" && isMarkdownPath(entry.name));
  const dirs = entries.filter((entry) => entry.kind === "dir");
  const dirsByLowerName = new Map(dirs.map((dir) => [dir.name.toLowerCase(), dir]));
  const mergedDirs = new Set<string>();
  const groups: EntryGroup[] = [];

  for (const file of files) {
    const name = stripMarkdownExtension(file.name);
    const dir = dirsByLowerName.get(name.toLowerCase()) ?? null;
    if (dir) {
      mergedDirs.add(dir.name.toLowerCase());
    }
    groups.push({ name, file, dir });
  }

  for (const dir of dirs) {
    if (!mergedDirs.has(dir.name.toLowerCase())) {
      groups.push({ name: dir.name, file: null, dir });
    }
  }

  return groups;
}
