import { renderMarkdown } from "../../core/markdown.ts";
import {
  assertSafeRelativePath,
  isMarkdownPath,
  normalizeRootRelativePath,
} from "../../core/path.ts";
import type { WikiContext } from "../../types.ts";
import { HttpError, jsonResponse, requiredPathParam } from "../http.ts";

export async function renderRoute(context: WikiContext, url: URL): Promise<Response> {
  const pagePath = requiredPathParam(url);
  if (!isMarkdownPath(pagePath)) {
    throw new HttpError(400, "Render path must be a Markdown file");
  }

  const absolutePath = await assertSafeRelativePath(context.rootDir, pagePath);
  const file = Bun.file(absolutePath);
  if (!(await file.exists())) {
    throw new HttpError(404, "Page not found");
  }

  const source = await file.text();
  return jsonResponse(renderMarkdown(context.flavor, normalizeRootRelativePath(pagePath), source));
}
