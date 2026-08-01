/**
 * The one definition of how a page path becomes a URL. Both `toHref` and the
 * React router import it, so the server-rendered `href` and the client-side
 * route cannot drift apart.
 */
const READ_PREFIX = "/read/";

export function toReadUrl(pagePath: string, anchor?: string): string {
  const encoded = pagePath.split("/").map(encodeURIComponent).join("/");
  return anchor ? `${READ_PREFIX}${encoded}#${encodeURIComponent(anchor)}` : READ_PREFIX + encoded;
}

/** Returns the root-relative page path, or null when the URL is not a page URL. */
export function pagePathFromReadUrl(pathname: string): string | null {
  if (!pathname.startsWith(READ_PREFIX)) {
    return null;
  }

  const [encoded = ""] = pathname.slice(READ_PREFIX.length).split("#", 1);
  return decodeReadPath(encoded);
}

/**
 * Normalizes the splat a router hands back. Routers differ on whether path
 * params arrive decoded, so a segment is only decoded when it still looks
 * percent-encoded.
 */
export function decodeReadPath(splat: string): string | null {
  const segments = splat.split("/").filter((segment) => segment !== "");
  if (segments.length === 0) {
    return null;
  }
  return segments.map(decodeSegment).join("/");
}

function decodeSegment(segment: string): string {
  if (!segment.includes("%")) {
    return segment;
  }
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
