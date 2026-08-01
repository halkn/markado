import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import type { Flavor } from "../../src/flavors/types.ts";
import type { WikiContext } from "../../src/types.ts";

/**
 * Builds a wiki in a temporary directory. Keys ending in `/` create an empty
 * directory; every other key writes a file, creating parents as needed.
 */
export function createWiki(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "mdiv-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(root, relativePath);
    if (relativePath.endsWith("/")) {
      mkdirSync(absolutePath, { recursive: true });
      continue;
    }
    mkdirSync(dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, contents);
  }

  return root;
}

export function wikiContext(
  rootDir: string,
  flavor: Flavor,
  overrides: Partial<WikiContext> = {},
): WikiContext {
  return {
    rootDir,
    initialPagePath: null,
    mode: "tree",
    flavor,
    ...overrides,
  };
}

export function nodeNames(nodes: { name: string }[]): string[] {
  return nodes.map((node) => node.name);
}
