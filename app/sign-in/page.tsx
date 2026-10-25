import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return <main id="main-content" className="mx-auto max-w-lg px-6 py-16">
    <Link href="/" className="underline">Wealth Portfolio prototype</Link>
    <h1 className="mt-8 text-3xl font-semibold">Sign in to a demo account</h1>
    <p className="mt-4 text-stone-600">Synthetic accounts only. Public registration is disabled. Use a seeded email and the password configured locally by the developer.</p>
    <SignInForm />
  </main>;
}
