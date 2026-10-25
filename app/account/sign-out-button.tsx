"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

export function SignOutButton({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <div className={compact ? "compact-sign-out" : "mt-6"}>
      <button
        className="button-quiet"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError("");
          try {
            const result = await authClient.signOut();
            if (result.error) setError("Sign-out failed. Please retry.");
            else {
              router.replace("/sign-in");
              router.refresh();
            }
          } catch {
            setError("Sign-out unavailable. Please retry.");
          } finally {
            setPending(false);
          }
        }}
      >
        {pending ? "Signing out…" : "Sign out"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
