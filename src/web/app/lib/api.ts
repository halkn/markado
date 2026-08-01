import type { RenderResponse, TreeResponse } from "../../../types.ts";

export async function fetchTree(): Promise<TreeResponse> {
  return requestJson<TreeResponse>("/api/tree");
}

export async function fetchPage(pagePath: string): Promise<RenderResponse> {
  return requestJson<RenderResponse>(`/api/render?path=${encodeURIComponent(pagePath)}`);
}

export function assetUrl(assetPath: string): string {
  return `/api/asset?path=${encodeURIComponent(assetPath)}`;
}

async function requestJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    // The server answers with a plain-text reason; surfacing it is more useful
    // than a status code alone for a local reader.
    throw new Error((await response.text()) || response.statusText);
  }
  return (await response.json()) as T;
}
