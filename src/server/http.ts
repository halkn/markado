/** Carries the status a route wants, instead of collapsing everything to 400. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonResponse(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export function textResponse(value: string, mimeType: string): Response {
  return new Response(value, { headers: { "Content-Type": mimeType } });
}

export function requiredPathParam(url: URL): string {
  const value = url.searchParams.get("path");
  if (!value) {
    throw new HttpError(400, "Missing path parameter");
  }
  return value;
}
