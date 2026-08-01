import { extname } from "node:path";

const MIME_TYPES = new Map<string, string>([
  [".css", "text/css"],
  [".html", "text/html"],
  [".js", "text/javascript"],
  [".json", "application/json"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".svg", "image/svg+xml"],
  [".pdf", "application/pdf"],
  [".md", "text/markdown; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
]);

export function contentType(pathname: string): string {
  return MIME_TYPES.get(extname(pathname).toLowerCase()) ?? "application/octet-stream";
}
