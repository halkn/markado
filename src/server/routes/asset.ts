import { assertSafeRelativePath } from "../../core/path.ts";
import type { WikiContext } from "../../types.ts";
import { ASSET_CSP, securityHeaders } from "../headers.ts";
import { HttpError, requiredPathParam } from "../http.ts";
import { contentType } from "../mime.ts";

export async function assetRoute(context: WikiContext, url: URL): Promise<Response> {
  const assetPath = requiredPathParam(url);
  // Containment before existence: a symlink pointing outside the root has to
  // answer the same whether or not its target is there, or the 400/404 split
  // becomes a way to probe the filesystem.
  const absolutePath = await assertSafeRelativePath(context.rootDir, assetPath);
  const file = Bun.file(absolutePath);
  if (!(await file.exists())) {
    throw new HttpError(404, "Asset not found");
  }

  return new Response(file, {
    headers: {
      "Content-Type": contentType(absolutePath),
      ...securityHeaders(ASSET_CSP),
    },
  });
}
