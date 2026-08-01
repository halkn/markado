import { extname } from "node:path";
import { decodeReference, type LinkResolveOptions, type LinkTarget } from "../../core/links.ts";
import {
  isLocalReference,
  isMarkdownPath,
  normalizeRootRelativePath,
  resolveMarkdownRelativePath,
} from "../../core/path.ts";

/**
 * Azure DevOps Wiki links differ from plain Markdown in two ways: they may be
 * absolute from the wiki root (`/Guide/Install`) and they usually omit the `.md`
 * extension. Anything else returns null and falls back to the core resolver.
 */
export function resolveAdoLink(
  fromPagePath: string,
  href: string,
  options: LinkResolveOptions,
): LinkTarget | null {
  if (href.startsWith("#") || !isLocalReference(href)) {
    return null;
  }

  const [rawPath, anchor = ""] = href.split("#", 2);
  if (!rawPath) {
    return null;
  }

  const decoded = decodeReference(rawPath);
  const isRootAbsolute = decoded.startsWith("/");
  const isExtensionless = !options.forceAsset && extname(decoded) === "";
  if (!isRootAbsolute && !isExtensionless) {
    return null;
  }

  const candidate = (isExtensionless ? `${decoded}.md` : decoded).replace(/^\/+/, "");
  if (!candidate || candidate === ".md") {
    return null;
  }

  const resolved = isRootAbsolute
    ? normalizeRootRelativePath(candidate)
    : resolveMarkdownRelativePath(fromPagePath, candidate);
  if (!resolved || resolved === ".." || resolved.startsWith("../")) {
    return null;
  }

  const kind = !options.forceAsset && isMarkdownPath(resolved) ? "page" : "asset";
  return anchor ? { kind, path: resolved, anchor } : { kind, path: resolved };
}
