import "server-only";
import { headers } from "next/headers";
import { getAuth } from "./auth";
import { ServiceError } from "./service-error";

// Only verified database sessions supply identity. Never read userId/role headers.
export async function requireUser() {
  const session = await getAuth().api.getSession({
    headers: await headers(),
    query: { disableCookieCache: true },
  });
  if (!session || session.session.expiresAt <= new Date())
    throw new ServiceError(401, "Sign in required.");
  return { id: session.user.id };
}
