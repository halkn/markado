import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { compareByName } from "../../core/tree.ts";
import { stripMarkdownExtension } from "../../core/path.ts";
import type { EntryGroupComparator } from "../types.ts";

export const ORDER_FILE = ".order";

/**
 * Azure DevOps Wiki stores sibling page ordering in a `.order` file. Entries are
 * matched case-insensitively and may omit the `.md` extension. Pages missing
 * from the file sort after the listed ones, by name.
 */
export async function createOrderComparator(
  dirAbsolutePath: string,
): Promise<EntryGroupComparator | null> {
  const order = await readOrder(dirAbsolutePath);
  if (order.size === 0) {
    return null;
  }

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
    return compareByName(left, right);
  };
}

export async function readOrder(dirAbsolutePath: string): Promise<Map<string, number>> {
  const order = new Map<string, number>();

  let contents: string;
  try {
    contents = await readFile(join(dirAbsolutePath, ORDER_FILE), "utf8");
  } catch {
    return order;
  }

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const key = stripMarkdownExtension(trimmed).toLowerCase();
    if (!order.has(key)) {
      order.set(key, order.size);
    }
  }

  return order;
}
