"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return <div className="mt-6">
    <button className="rounded border px-4 py-2 disabled:opacity-50" disabled={pending} onClick={async () => {
      setPending(true); setError("");
      try {
        const result = await authClient.signOut();
        if (result.error) setError("Sign-out failed. Please retry.");
        else { router.replace("/sign-in"); router.refresh(); }
      } catch { setError("Sign-out unavailable. Please retry."); }
      finally { setPending(false); }
    }}>{pending ? "Signing out…" : "Sign out"}</button>
    <p role="status" className="mt-2 text-red-800">{error}</p>
  </div>;
}
