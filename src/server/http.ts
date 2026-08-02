import { PathSafetyError } from "../core/path.ts";
import { DATA_CSP, securityHeaders } from "./headers.ts";

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
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...securityHeaders(DATA_CSP),
    },
  });
}

/** Plain-text replies, so that even a 404 arrives with the same guarantees. */
export function textResponse(body: string, status: number): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      ...securityHeaders(DATA_CSP),
    },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return textResponse(error.message, error.status);
  }
  if (error instanceof PathSafetyError) {
    return textResponse(error.message, 400);
  }

  // Node's filesystem errors quote the absolute path they failed on, and the
  // person running mdiv is the only one who needs it. The response says nothing.
  console.error("mdiv: unhandled request error", error);
  return textResponse("Internal server error", 500);
}

export function requiredPathParam(url: URL): string {
  const value = url.searchParams.get("path");
  if (!value) {
    throw new HttpError(400, "Missing path parameter");
  }
  return value;
}
