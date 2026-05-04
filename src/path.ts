import { dirname, isAbsolute, normalize, resolve, sep } from "node:path";

export function isMarkdownPath(pathname: string): boolean {
  return /\.md$/i.test(pathname);
}

export function toPosixPath(pathname: string): string {
  return pathname.split(sep).join("/");
}

export function stripMarkdownExtension(name: string): string {
  return name.replace(/\.md$/i, "");
}

export function assertSafeRelativePath(rootDir: string, relativePath: string): string {
  if (!relativePath || isAbsolute(relativePath)) {
    throw new Error("Path must be relative to the wiki root");
  }

  const normalizedRelative = normalize(relativePath);
  if (normalizedRelative === ".." || normalizedRelative.startsWith(`..${sep}`)) {
    throw new Error("Path escapes the wiki root");
  }

  const absolutePath = resolve(rootDir, normalizedRelative);
  const normalizedRoot = resolve(rootDir);
  if (absolutePath !== normalizedRoot && !absolutePath.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error("Path escapes the wiki root");
  }

  return absolutePath;
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
