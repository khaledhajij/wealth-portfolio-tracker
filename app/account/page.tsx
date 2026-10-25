import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/server/session";
import { ServiceError } from "@/lib/server/service-error";
import { SignOutButton } from "./sign-out-button";
export const dynamic = "force-dynamic";

export default async function AccountPage() {
  let user;
  try { user = await requireUser(); } catch (error) {
    if (error instanceof ServiceError && error.status === 401) redirect("/sign-in");
    return <main id="main-content" className="mx-auto max-w-lg px-6 py-16"><h1 className="text-3xl font-semibold">Authentication unavailable</h1>
      <p className="mt-4">We couldn’t verify your session. Please try signing in again.</p><Link className="mt-4 inline-block underline" href="/sign-in">Return to sign in</Link></main>;
  }
  return <main id="main-content" className="mx-auto max-w-lg px-6 py-16">
    <h1 className="text-3xl font-semibold">Your account</h1>
    <p className="mt-4">Signed in as: <strong>{user.id}</strong></p>
    <p className="mt-4 text-stone-600">Portfolio access is checked on the server for each operation.</p>
    <Link className="mt-4 inline-block underline" href="/portfolios">Open your portfolios</Link>
    <SignOutButton />
  </main>;
}
