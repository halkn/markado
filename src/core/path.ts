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

/**
 * Lexical containment check. Never touches the filesystem, so it can run before
 * an existence check and lets callers distinguish "escapes the root" (400) from
 * "does not exist" (404).
 */
export function resolveSafePath(rootDir: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new PathSafetyError("Path must be relative to the wiki root");
  }

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
