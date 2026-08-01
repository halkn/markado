import type { Flavor } from "../types.ts";
import { resolveAdoLink } from "./links.ts";
import { adoMermaidPlugin } from "./mermaid.ts";
import { createOrderComparator } from "./order.ts";
import { groupPageFolders } from "./pageFolder.ts";
import { adoTocPlugin } from "./toc.ts";

/**
 * Azure DevOps Wiki compatibility. `.attachments` and `.order` are dot-prefixed,
 * so the core already keeps them out of the tree while leaving them reachable
 * as assets.
 */
export const adoFlavor: Flavor = {
  name: "ado",
  groupEntries: groupPageFolders,
  createComparator: createOrderComparator,
  markdownItPlugins: [adoTocPlugin, adoMermaidPlugin],
  resolveLink: resolveAdoLink,
};
