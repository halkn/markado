import { access } from "node:fs/promises";
import { join } from "node:path";
import { adoFlavor } from "./ado/index.ts";
import { plainFlavor } from "./plain.ts";
import type { Flavor, FlavorName } from "./types.ts";

export type FlavorSelection = FlavorName | "auto";

export const FLAVOR_SELECTIONS: FlavorSelection[] = ["auto", "plain", "ado"];

/** Markers Azure DevOps Wiki always writes at the wiki root. */
const ADO_ROOT_MARKERS = [".order", ".attachments"];

export function isFlavorSelection(value: string): value is FlavorSelection {
  return (FLAVOR_SELECTIONS as string[]).includes(value);
}

export function getFlavor(name: FlavorName): Flavor {
  return name === "ado" ? adoFlavor : plainFlavor;
}

export async function detectFlavorName(rootDir: string): Promise<FlavorName> {
  const found = await Promise.all(ADO_ROOT_MARKERS.map((marker) => exists(join(rootDir, marker))));
  return found.includes(true) ? "ado" : "plain";
}

export async function resolveFlavor(
  rootDir: string,
  selection: FlavorSelection = "auto",
): Promise<Flavor> {
  return getFlavor(selection === "auto" ? await detectFlavorName(rootDir) : selection);
}

async function exists(absolutePath: string): Promise<boolean> {
  try {
    await access(absolutePath);
    return true;
  } catch {
    return false;
  }
}
