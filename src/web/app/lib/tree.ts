import type { TreeNode } from "../../../types.ts";

/**
 * Directories have no path of their own, so expansion state is keyed by the
 * node's position in the tree. Files reuse their path, which keeps the key
 * stable when a directory is renamed above them.
 */
export function childKey(parentKey: string, node: TreeNode): string {
  if (node.path) {
    return node.path;
  }
  return parentKey ? `${parentKey}/${node.name}` : node.name;
}

/** Keys of every node that has to be open for `pagePath` to be visible. */
export function expandedKeysFor(root: TreeNode, pagePath: string | null): Set<string> {
  const keys = new Set<string>();
  if (pagePath) {
    collectAncestors(root.children, "", pagePath, [], keys);
  }
  return keys;
}

function collectAncestors(
  nodes: TreeNode[],
  parentKey: string,
  pagePath: string,
  trail: string[],
  keys: Set<string>,
): boolean {
  for (const node of nodes) {
    const key = childKey(parentKey, node);
    if (node.path === pagePath) {
      for (const ancestor of trail) {
        keys.add(ancestor);
      }
      return true;
    }
    if (collectAncestors(node.children, key, pagePath, [...trail, key], keys)) {
      return true;
    }
  }
  return false;
}
