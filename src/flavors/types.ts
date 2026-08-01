import type MarkdownIt from "markdown-it";
import type { LinkResolveOptions, LinkTarget } from "../core/links.ts";

export type FlavorName = "plain" | "ado";

/** A single filesystem entry discovered while scanning a directory. */
export type DirEntry = {
  /** Real name on disk, including the extension. */
  name: string;
  /** Wiki-root-relative POSIX path. */
  relativePath: string;
  absolutePath: string;
  kind: "file" | "dir";
};

/**
 * A tree node candidate before ordering is applied. `file` and `dir` may both be
 * set: Azure DevOps Wiki pairs `Guide.md` with a `Guide/` folder of child pages.
 */
export type EntryGroup = {
  /** Display name, without the Markdown extension. */
  name: string;
  file: DirEntry | null;
  dir: DirEntry | null;
};

export type EntryGroupComparator = (left: EntryGroup, right: EntryGroup) => number;

export type MarkdownItPlugin = (md: MarkdownIt) => void;

/**
 * A flavor layers wiki-specific conventions over the generic Markdown reader.
 * Every hook is optional; omitting one falls back to the core behaviour.
 */
export type Flavor = {
  readonly name: FlavorName;
  /** Hide entries beyond the dot-prefixed ones the core already skips. */
  excludeFromTree?(entry: DirEntry): boolean;
  /** Bundle sibling entries into tree nodes. */
  groupEntries?(entries: DirEntry[]): EntryGroup[];
  /** Per-directory ordering. Returning null falls back to name ordering. */
  createComparator?(dirAbsolutePath: string): Promise<EntryGroupComparator | null>;
  /** Syntax extensions, e.g. `[[_TOC_]]` or GitHub Alerts. */
  markdownItPlugins?: MarkdownItPlugin[];
  /** Flavor-specific link resolution. Returning null falls back to the core. */
  resolveLink?(fromPagePath: string, href: string, options: LinkResolveOptions): LinkTarget | null;
};
