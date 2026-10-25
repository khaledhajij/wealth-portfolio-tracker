import Link from "next/link";
import { SignInForm } from "./sign-in-form";

export default function SignInPage() {
  return <main id="main-content" className="mx-auto max-w-lg px-6 py-16">
    <Link href="/" className="underline">Wealth Portfolio Tracker</Link>
    <h1 className="mt-8 text-3xl font-semibold">Sign in to your account</h1>
    <p className="mt-4 text-stone-600">Enter your email and password to access your portfolios. Public registration is disabled.</p>
    <SignInForm />
  </main>;
}
