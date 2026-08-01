import {
  isLocalReference,
  isMarkdownPath,
  normalizeRootRelativePath,
  resolveMarkdownRelativePath,
} from "./path.ts";

/**
 * Resolved meaning of a Markdown reference, independent of any URL scheme.
 * Only `toHref` knows how the current frontend addresses pages and assets, so a
 * React router can be swapped in without touching flavors or the renderer.
 */
export type LinkTarget =
  | { kind: "page"; path: string; anchor?: string }
  | { kind: "asset"; path: string; anchor?: string }
  | { kind: "anchor"; id: string }
  | { kind: "external"; href: string };

export type LinkResolveOptions = {
  /** Images always address assets, even when the reference ends in `.md`. */
  forceAsset?: boolean;
};

export function resolveLinkTarget(
  fromPagePath: string,
  href: string,
  options: LinkResolveOptions = {},
): LinkTarget {
  if (href.startsWith("#")) {
    return { kind: "anchor", id: href.slice(1) };
  }
  if (!isLocalReference(href)) {
    return { kind: "external", href };
  }

  const [rawPath, anchor = ""] = href.split("#", 2);
  if (!rawPath) {
    return { kind: "external", href };
  }

  const resolved = resolveMarkdownRelativePath(fromPagePath, decodeReference(rawPath));
  if (resolved === ".." || resolved.startsWith("../")) {
    return { kind: "external", href };
  }

  const path = normalizeRootRelativePath(resolved);
  const kind = !options.forceAsset && isMarkdownPath(path) ? "page" : "asset";
  return anchor ? { kind, path, anchor } : { kind, path };
}

export function toHref(target: LinkTarget): string {
  switch (target.kind) {
    case "page":
      return withAnchor(`/?path=${encodeURIComponent(target.path)}`, target.anchor);
    case "asset":
      return withAnchor(`/api/asset?path=${encodeURIComponent(target.path)}`, target.anchor);
    case "anchor":
      return `#${target.id}`;
    case "external":
      return target.href;
  }
}

/**
 * Data attributes let the frontend intercept navigation without re-parsing the
 * href it was given.
 */
export function linkDataAttributes(target: LinkTarget): Record<string, string> {
  switch (target.kind) {
    case "page":
      return {
        "data-mdiv-kind": "page",
        "data-mdiv-path": target.path,
        ...(target.anchor ? { "data-mdiv-anchor": target.anchor } : {}),
      };
    case "asset":
      return { "data-mdiv-kind": "asset", "data-mdiv-path": target.path };
    case "anchor":
      return { "data-mdiv-kind": "anchor", "data-mdiv-anchor": target.id };
    case "external":
      return {};
  }
}

function withAnchor(base: string, anchor: string | undefined): string {
  return anchor ? `${base}#${encodeURIComponent(anchor)}` : base;
}

/**
 * Azure DevOps Wiki links percent-encode spaces and non-ASCII page names.
 * `decodeURI` leaves reserved characters such as `%2F` alone, which keeps
 * traversal attempts from slipping past `resolveSafePath` later on.
 */
export function decodeReference(value: string): string {
  try {
    return decodeURI(value);
  } catch {
    return value;
  }
}
