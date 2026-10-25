"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignInForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const errorBox = useRef<HTMLParagraphElement>(null);
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true); setError("");
    try {
      const result = await authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")), rememberMe: false });
      if (result.error) setError("Sign-in failed. Check your credentials or the database/auth setup.");
      else { router.replace("/portfolios"); router.refresh(); }
    } catch { setError("Authentication is unavailable. Try again after checking server setup."); }
    finally { setPending(false); }
  }
  return <form onSubmit={submit} className="mt-8 grid gap-4">
    <label className="grid gap-2">Email<input className="rounded border bg-white p-3" name="email" type="email" autoComplete="username" required maxLength={254} /></label>
    <label className="grid gap-2">Password<input className="rounded border bg-white p-3" name="password" type="password" autoComplete="current-password" required minLength={12} maxLength={128} /></label>
    <button disabled={pending} className="rounded bg-emerald-900 px-4 py-3 text-white disabled:opacity-50">{pending ? "Signing in…" : "Sign in"}</button>
    {error && <p ref={errorBox} tabIndex={-1} role="alert" className="text-sm text-red-800">{error}</p>}
  </form>;
}
