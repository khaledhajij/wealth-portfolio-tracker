import "server-only";
import { ZodError } from "zod";
import { ServiceError } from "./service-error";
import { authSettings } from "./auth-settings";

export function privateJson(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie" } });
}
export async function api(operation: () => Promise<unknown>, successStatus = 200) {
  try { return privateJson(await operation(), successStatus); } catch (error) {
    if (error instanceof ServiceError) {
      const codes = { 400: "INVALID_REQUEST", 401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 409: "CONFLICT", 503: "UNAVAILABLE" } as const;
      return privateJson({ code: codes[error.status], error: error.message }, error.status);
    }
    if (error instanceof ZodError || error instanceof SyntaxError) return privateJson({ code: "INVALID_REQUEST", error: "Invalid request fields or values." }, 400);
    return privateJson({ code: "UNAVAILABLE", error: "Service unavailable. Check server configuration and database connectivity." }, 503);
  }
}
export async function mutationBody(request: Request) {
  const origin = request.headers.get("origin");
  if (origin !== authSettings().baseURL) throw new ServiceError(403, "Same-origin request required.");
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json") throw new ServiceError(400, "JSON required.");
  // Bound the actual streamed body, not only the caller-controlled Content-Length.
  const reader = request.body?.getReader();
  if (!reader) throw new ServiceError(400, "JSON body required.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) { await reader.cancel(); throw new ServiceError(400, "Request too large."); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
}
