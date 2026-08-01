import type { Flavor } from "./types.ts";

/**
 * A generic local Markdown reader: no ordering files, no page folders, no
 * wiki-specific syntax. Every hook is left unset so the core defaults apply.
 */
export const plainFlavor: Flavor = {
  name: "plain",
};
