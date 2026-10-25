"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
export default function PortfolioError({ reset }: { reset: () => void }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <section className="empty-state error-state" role="alert">
      <p className="eyebrow">WORKSPACE UNAVAILABLE</p>
      <h1>We couldn’t load your portfolio data.</h1>
      <p>
        Please try again. If this continues, check the application’s database
        configuration and connection.
      </p>
      <button
        className="button-primary"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        {pending ? "Retrying…" : "Try again"}
      </button>
      <a className="text-link" href="/sign-in">
        Return to sign in
      </a>
    </section>
  );
}
