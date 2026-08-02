import { createHash } from "node:crypto";
import type { SecurityOptions } from "./security.ts";

/**
 * The one definition of the response headers. A policy assembled at the call
 * site drifts per route, and a route that quietly ships without one is exactly
 * the route an untrusted document would find.
 */
const BASE_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "DENY",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Resource-Policy": "same-origin",
};

/** API responses are data. Nothing in them is ever meant to load anything. */
export const DATA_CSP = "default-src 'none'; base-uri 'none'; frame-ancestors 'none'";

/**
 * Assets are files from the repository the reader opened. `sandbox` is what
 * keeps a wiki-local `.svg` or `.html` from running as a same-origin document
 * when it is opened directly rather than through an `<img>`.
 */
export const ASSET_CSP = `${DATA_CSP}; sandbox`;

export function securityHeaders(contentSecurityPolicy: string): Record<string, string> {
  return { ...BASE_HEADERS, "Content-Security-Policy": contentSecurityPolicy };
}

/**
 * `script-src` carries a hash instead of `'unsafe-inline'`, so the shell's
 * theme bootstrap keeps running while a document's own markup cannot introduce
 * a script. The hash is read back out of the HTML being served, which means it
 * follows the Vite build without a second place to keep in step.
 *
 * `style-src` cannot be tightened the same way: Mermaid puts a `<style>` inside
 * every SVG it generates, and Radix and react-resizable-panels position
 * themselves with inline `style` attributes. None of those can carry a nonce.
 */
export function shellCsp(html: string, security: SecurityOptions): string {
  const hashes = inlineScriptHashes(html);
  const images = security.allowRemoteImages ? "'self' data: https:" : "'self' data:";

  return [
    "default-src 'self'",
    ["script-src 'self'", ...hashes].join(" "),
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images}`,
    // Vite inlines every asset as a data URI; see `assetsInlineLimit`.
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'none'",
  ].join("; ");
}

const INLINE_SCRIPT = /<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi;

const hashCache = new Map<string, string[]>();

function inlineScriptHashes(html: string): string[] {
  const cached = hashCache.get(html);
  if (cached) {
    return cached;
  }

  const hashes = [...html.matchAll(INLINE_SCRIPT)].map(
    (match) => `'sha256-${createHash("sha256").update(match[1], "utf8").digest("base64")}'`,
  );
  hashCache.set(html, hashes);
  return hashes;
}
