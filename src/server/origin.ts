import { isLoopbackAddress } from "./bind.ts";
import { HttpError } from "./http.ts";
import type { SecurityOptions } from "./security.ts";

const ALLOWED_METHODS = new Set(["GET", "HEAD"]);

/**
 * The server is read-only and unauthenticated, so the browser's own origin
 * rules are the only thing standing between a page the reader happens to visit
 * and every file under the wiki root.
 */
export function assertAllowedRequest(request: Request, url: URL, security: SecurityOptions): void {
  if (!ALLOWED_METHODS.has(request.method)) {
    throw new HttpError(405, "Method not allowed");
  }

  const host = request.headers.get("host") ?? url.host;

  const origin = request.headers.get("origin");
  if (origin !== null && originHost(origin) !== host) {
    throw new HttpError(403, "Cross-origin request refused");
  }

  if (!isAllowedHost(hostnameOf(host), security)) {
    throw new HttpError(403, "Unexpected Host header");
  }
}

/**
 * A DNS rebinding attack needs a name it controls to resolve to the loopback
 * address, so on the default binding only loopback literals are accepted. Once
 * `--allow-remote-access` is in play the reader reaches the server by whatever
 * name their network hands out, and the check can only be a warning at startup.
 */
function isAllowedHost(hostname: string, security: SecurityOptions): boolean {
  return !isLoopbackAddress(security.bind) || isLoopbackAddress(hostname);
}

function originHost(origin: string): string | null {
  try {
    return new URL(origin).host;
  } catch {
    return null;
  }
}

function hostnameOf(host: string): string {
  if (host.startsWith("[")) {
    return host.slice(1, host.indexOf("]"));
  }
  const separator = host.lastIndexOf(":");
  return separator === -1 ? host : host.slice(0, separator);
}
