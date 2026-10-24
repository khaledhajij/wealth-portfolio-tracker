import Link from "next/link";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-6 sm:px-10">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-stone-300 py-7">
        <p className="text-sm font-bold tracking-wide">WEALTH / PORTFOLIO TRACKER</p>
        <span className="rounded-full border border-emerald-900/20 px-3 py-1 text-xs font-semibold">
          Phase 3 · Prototype
        </span>
      </header>

      <main id="main-content" className="flex-1 py-14 sm:py-20">
        <Link href="/sign-in" className="mb-6 inline-block rounded border border-emerald-900 px-4 py-2">Demo account sign in</Link>
        <p className="text-xs font-bold tracking-[0.18em] text-emerald-800 uppercase">
          Talent Syria technical assessment
        </p>
        <h1 className="mt-5 max-w-2xl text-4xl leading-tight font-semibold tracking-tight sm:text-6xl">
          A clearer view of what you hold.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-stone-600">
          A small portfolio tracker in progress, designed around stocks, crypto,
          and cash with manual prices in USD.
        </p>

        <section aria-labelledby="prototype-heading" className="mt-12 rounded-2xl border border-stone-300 bg-white p-6 sm:p-8">
          <div className="flex items-center gap-3">
            <span aria-hidden="true" className="size-2 rounded-full bg-amber-600" />
            <h2 id="prototype-heading" className="text-lg font-semibold">
              An assessment prototype in progress.
            </h2>
          </div>
          <p className="mt-4 max-w-2xl leading-7 text-stone-600">
            This introduction displays no portfolio balances or prices. Demo
            sign-in requires the configured database, migrations and seeded
            credentials. Dashboard screens and the read-only AI assistant are
            planned for later phases.
          </p>
          <a href="#planned-features" className="mt-6 inline-flex rounded-lg bg-emerald-950 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
            Explore the planned scope <span aria-hidden="true" className="ml-3">↓</span>
          </a>
        </section>

        <section id="planned-features" aria-labelledby="scope-heading" className="mt-12 scroll-mt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="scope-heading" className="text-xl font-semibold">Planned scope</h2>
            <p className="text-sm text-stone-600">Interface and assistant work remains</p>
          </div>
          <dl className="mt-6 grid gap-6 sm:grid-cols-3">
            <div className="border-t border-stone-300 pt-5">
              <dt className="font-semibold">Holdings & movements</dt>
              <dd className="mt-2 text-sm leading-6 text-stone-600">
                Quantities derived from recorded movements, valued using timestamped
                manual prices. Cash has a fixed USD 1 unit price.
              </dd>
            </div>
            <div className="border-t border-stone-300 pt-5">
              <dt className="font-semibold">Portfolio permissions</dt>
              <dd className="mt-2 text-sm leading-6 text-stone-600">
                Owner, Editor, and Viewer access, enforced on the server for each
                portfolio.
              </dd>
            </div>
            <div className="border-t border-stone-300 pt-5">
              <dt className="font-semibold">A read-only assistant</dt>
              <dd className="mt-2 text-sm leading-6 text-stone-600">
                Answers grounded in authorized portfolio data, without changing
                holdings or prices.
              </dd>
            </div>
          </dl>
        </section>
      </main>

      <footer className="border-t border-stone-300 py-6 text-xs leading-6 text-stone-600">
        Assessment prototype · Manual valuation, no market feeds or trade execution.
      </footer>
    </div>
  );
}
