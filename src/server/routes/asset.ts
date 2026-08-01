import { assertRealPathWithinRoot, resolveSafePath } from "../../core/path.ts";
import type { WikiContext } from "../../types.ts";
import { HttpError, requiredPathParam } from "../http.ts";
import { contentType } from "../mime.ts";

export async function assetRoute(context: WikiContext, url: URL): Promise<Response> {
  const assetPath = requiredPathParam(url);
  // Lexical containment first, existence second, symlinks last: that ordering is
  // what lets a missing-but-safe path answer 404 instead of 400.
  const absolutePath = resolveSafePath(context.rootDir, assetPath);
  const file = Bun.file(absolutePath);
  if (!(await file.exists())) {
    throw new HttpError(404, "Asset not found");
  }
  await assertRealPathWithinRoot(context.rootDir, absolutePath);

  return new Response(file, {
    headers: { "Content-Type": contentType(assetPath) },
  });
}
