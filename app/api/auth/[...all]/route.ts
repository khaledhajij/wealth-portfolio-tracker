import { getAuth } from "@/lib/server/auth";
import { privateJson } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const path = new URL(request.url).pathname;
  const permitted = request.method === "GET" ? ["/api/auth/get-session"] : ["/api/auth/sign-in/email", "/api/auth/sign-out"];
  if (!permitted.includes(path)) return privateJson({ error: "Not found." }, 404);
  try {
    const response = await getAuth().handler(request);
    response.headers.set("Cache-Control", "private, no-store");
    response.headers.set("Vary", "Cookie");
    return response;
  } catch {
    return privateJson({ error: "Authentication unavailable. Check configuration and database setup." }, 503);
  }
}
export const GET = handle;
export const POST = handle;
