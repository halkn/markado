import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, normalize, resolve, sep } from "node:path";

/** Raised when a request tries to reach outside the wiki root. Maps to HTTP 400. */
export class PathSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathSafetyError";
  }
}

export function isMarkdownPath(pathname: string): boolean {
  return /\.md$/i.test(pathname);
}

export function toPosixPath(pathname: string): string {
  return pathname.split(sep).join("/");
}

export function stripMarkdownExtension(name: string): string {
  return name.replace(/\.md$/i, "");
}

export function normalizeRootRelativePath(pathname: string): string {
  const normalized = normalize(pathname).split(sep).join("/");
  return normalized === "." ? "" : normalized;
}

export function resolveMarkdownRelativePath(currentPagePath: string, target: string): string {
  return normalizeRootRelativePath(`${dirname(currentPagePath)}/${target}`);
}

export function isLocalReference(value: string): boolean {
  return !/^[a-z][a-z0-9+.-]*:/i.test(value) && !value.startsWith("//") && !value.startsWith("#");
}

/** Matches a Windows drive letter prefix, which is absolute only on Windows. */
const DRIVE_LETTER = /^[a-z]:/i;

/** Separators that survived one round of URL decoding, i.e. were encoded twice. */
const ENCODED_SEPARATOR = /%2f|%5c|%2e%2e/i;

// oxlint-disable-next-line no-control-regex
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/;

/**
 * Everything a wiki path may not be, spelled out rather than left to
 * `node:path`. Those helpers answer per platform: on Linux `C:\secret` is not
 * absolute and `a\..\..\x` is one long filename, so a Windows-shaped traversal
 * would pass a Linux-only test suite and still be a traversal on Windows.
 */
function assertRelativePosixPath(relativePath: string): void {
  if (!relativePath) {
    throw new PathSafetyError("Path must be relative to the wiki root");
  }
  if (CONTROL_CHARACTER.test(relativePath)) {
    throw new PathSafetyError("Path contains control characters");
  }
  if (ENCODED_SEPARATOR.test(relativePath)) {
    throw new PathSafetyError("Path contains an encoded separator");
  }
  if (relativePath.includes("\\")) {
    throw new PathSafetyError("Path must use / as a separator");
  }
  if (relativePath.startsWith("/") || DRIVE_LETTER.test(relativePath) || isAbsolute(relativePath)) {
    throw new PathSafetyError("Path must be relative to the wiki root");
  }
  if (relativePath.split("/").includes("..")) {
    throw new PathSafetyError("Path escapes the wiki root");
  }
}

/**
 * Lexical containment check. Never touches the filesystem, so it can run before
 * an existence check and lets callers distinguish "escapes the root" (400) from
 * "does not exist" (404).
 */
export function resolveSafePath(rootDir: string, relativePath: string): string {
  assertRelativePosixPath(relativePath);

  const normalizedRelative = normalize(relativePath);
  if (normalizedRelative === ".." || normalizedRelative.startsWith(`..${sep}`)) {
    throw new PathSafetyError("Path escapes the wiki root");
  }

  const absolutePath = resolve(rootDir, normalizedRelative);
  const normalizedRoot = resolve(rootDir);
  if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}${sep}`)) {
    throw new PathSafetyError("Path escapes the wiki root");
  }

  return absolutePath;
}

/** Symlink-aware containment check. Tolerates paths that do not exist. */
export async function assertRealPathWithinRoot(
  rootDir: string,
  absolutePath: string,
): Promise<void> {
  const [realRoot, realPath] = await Promise.all([
    realpath(resolve(rootDir)),
    realpathOfNearestExisting(absolutePath),
  ]);

  if (realPath !== realRoot && !realPath.startsWith(`${realRoot}${sep}`)) {
    throw new PathSafetyError("Path escapes the wiki root");
  }
}

export async function assertSafeRelativePath(
  rootDir: string,
  relativePath: string,
): Promise<string> {
  const absolutePath = resolveSafePath(rootDir, relativePath);
  await assertRealPathWithinRoot(rootDir, absolutePath);
  return absolutePath;
}

async function realpathOfNearestExisting(absolutePath: string): Promise<string> {
  try {
    return await realpath(absolutePath);
  } catch (error) {
    const parent = dirname(absolutePath);
    if (!isMissingEntry(error) || parent === absolutePath) {
      throw error;
    }
    return join(await realpathOfNearestExisting(parent), basename(absolutePath));
  }
}

function isMissingEntry(error: unknown): boolean {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  return code === "ENOENT" || code === "ENOTDIR";
}
