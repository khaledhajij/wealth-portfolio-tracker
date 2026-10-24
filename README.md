# Wealth Portfolio Tracker

Talent Syria assessment prototype. **Phase 2: data foundation; PostgreSQL execution is unverified here.**

The home page remains a static introduction, not a connected dashboard. It displays no fabricated balances, prices or accounts. Prisma schema/migrations/seed and server-only Decimal valuation exist. Authentication, public endpoints, financial write services and chat are not implemented. See [PLAN](PLAN.md), [STATUS](docs/STATUS.md), and [AI usage](docs/AI_USAGE.md).

## Prerequisites and package manager

- Node.js **24.18.0** and npm **11.16.0**, the versions used for this phase. `.nvmrc` records Node; `package.json` declares the supported Node 24/npm 11 ranges and package manager. A Node version manager is optional; Windows PowerShell is supported.
- Network access to the npm registry for initial installation and the platform-specific Next.js/Tailwind compiler packages. No global Next.js CLI is needed.
- PostgreSQL **17.x** and `psql` are intended local prerequisites for database execution (not installed/verified here). See [database setup](docs/DATABASE.md). The static page, generated client, unit tests and build need no running database or AI key.

Use npm and the single `package-lock.json`; do not generate a second package manager lockfile. Direct dependencies are exact-pinned; `.npmrc` keeps future npm additions exact by default. `npm ci` installs the lockfile without updating it.

| Component | Pinned version |
| --- | --- |
| Next.js / eslint-config-next | 16.4.3 |
| React / React DOM | 19.3.1 |
| Tailwind CSS / @tailwindcss/postcss | 4.3.3 |
| TypeScript | 5.9.3 |
| ESLint | 9.39.5 |
| PostCSS | 8.5.31 |
| Prisma CLI / client / pg adapter | 7.10.1 |
| pg / @types/pg | 8.23.1 |
| tsx | 4.23.15 |

Next.js and React peer constraints were checked against npm metadata. TypeScript 5.9 keeps this small scaffold on the established compiler API. ESLint 10 was evaluated, but Next.js's bundled React/import/accessibility plugins still declare ESLint 9 peer ranges, producing an invalid dependency tree with 10. ESLint 9.39.5 is pinned for peer compatibility without force/legacy-peer flags. **ESLint 9 is end-of-life** and emits a deprecation warning; revisit the lint stack when the plugins support 10. This is a development-tool limitation, not a runtime feature. Type packages are also pinned in `package.json`.

## Local setup

From the repository root:

```powershell
node --version
npm --version
npm ci
npm run dev
```

Open the Local URL printed by Next.js, normally `http://localhost:3000`. Stop with Ctrl+C. The page uses system fonts and has no external font or data-fetch requirement.

Environment setup is required for database commands only. Copy the template **only if `.env.local` does not already exist**:

```powershell
Copy-Item .env.example .env.local
```

- `DATABASE_URL`: private PostgreSQL connection for Prisma CLI and internal scripts. URL-encode password characters; never paste the URL into chat/logs.
- `DATABASE_SSL_CA_FILE`: optional path to the official Supabase CA downloaded from Database Settings > SSL Configuration. Save it as `.certs/supabase-ca.crt` and set this variable in `.env.local` to `.certs/supabase-ca.crt` when certificate trust fails. The folder is ignored; certificate verification stays enabled. See [TLS setup](docs/DATABASE.md).
- `OPENAI_API_KEY`: reserved for a proposed direct OpenAI provider through Vercel AI SDK, subject to the AI phase's provider review.
- `AI_MODEL`: application-defined model identifier, to be validated/consumed in the AI phase. No model or default is selected yet.

All template values are empty. Prisma config/scripts use Next's environment loader to respect `.env.local`. No AI SDK/provider package is installed yet. These names are server-only: never add `NEXT_PUBLIC_` to credentials. `.gitignore` excludes `.env*` except `.env.example`, generated Prisma/build output, local logs and dependencies. Keep actual credentials out of Git and browser code.

Supabase is configured privately in `.env.local`. The user-terminal inspector now reports an authenticated PostgreSQL **17.11** session, empty `public` tables and no Prisma migration history. The agent's separate connection still times out. Phase 2 is **not complete**: migration application, seed repeatability and database acceptance have not been verified. From the terminal where inspection succeeds, run the following commands individually, stopping on any unexpected failure or conflicting migration state:

```powershell
npm run db:status
npm run db:migrate
npm run db:inspect
npm run db:status
npm run db:seed
npm run db:seed
npm run test:db
```

Before deployment, `db:status` may report the two local migrations as pending and return a nonzero exit code; that is expected for this inspected empty database. Authentication, TLS or other errors require diagnosis before proceeding. After deployment, both migrations should be finished with matching local checksums, and status should be up to date. The existing SQL is preserved. `db:migrate` uses `prisma migrate deploy`, which needs no shadow database; do not use reset/db push. See [database setup and safeguards](docs/DATABASE.md).

## Checks and production-mode local run

```powershell
npm run lint
npm run typecheck
npm run build
npm start
```

Lint runs ESLint directly (Next.js 16 removed `next lint`). Typecheck generates Prisma and Next route types, then runs `tsc --noEmit`. Build generates Prisma Client before compiling; `npm start` serves the build locally. No migration, seed, database connection or provider request is part of those checks. `npm test` runs seven Decimal valuation tests without PostgreSQL, including adding two units at unchanged price/cash. `npm run test:db` requires a dedicated database and is unverified here. See [database setup and checks](docs/DATABASE.md) and actual results in [STATUS](docs/STATUS.md).

## Code flow and decisions

- `app/layout.tsx` provides the document, metadata and global CSS; `app/page.tsx` serves `/` as a Server Component.
- `app/icon.svg` supplies a small local browser-tab icon through Next.js's file-based metadata convention.
- `app/globals.css` imports Tailwind 4; `postcss.config.mjs` enables its PostCSS plugin. There is no Tailwind 3 config or `@tailwind` directive setup.
- `next.config.ts`, `tsconfig.json`, and `eslint.config.mjs` keep framework/compiler/lint settings explicit. Next.js generates the ignored `next-env.d.ts` and `.next/` types during checks/startup.
- This is one Next.js application. No Express, Redis, state library, Shadcn components or chat was added. Package ESM mode allows TypeScript CLI scripts to use normal ESM imports/top-level await through tsx.
- `prisma.config.ts`/`prisma/schema.prisma` use Prisma 7's config URL, explicit generated client output and PostgreSQL driver adapter. `lib/server/` contains server-only database/valuation code. Generated files are ignored and regenerated by build/typecheck/tests.
- Internal valuation reads require a membership for a supplied internal actor and selected portfolio; phase 3 must derive that actor from a trusted session. There are no public endpoints or fake sessions. Database isolation/constraints are unverified until PostgreSQL checks run.
- Decimal valuation derives quantity from signed movements, multiplies by current manual USD prices, and returns strings. Cash price is fixed at 1; no P&L, settlement, market feed or cash balancing is implemented.

## Official references consulted

The first three references described Next.js 16.4.3 / Tailwind 4.3 when reviewed. Recheck version-specific documentation before adding later APIs.

- [Next.js installation and manual App Router setup](https://nextjs.org/docs/app/getting-started/installation)
- [Next.js ESLint flat configuration](https://nextjs.org/docs/app/api-reference/config/eslint)
- [Tailwind 4 Next.js integration](https://tailwindcss.com/docs/installation/framework-guides/nextjs)
- [Next.js CLI, including typegen](https://nextjs.org/docs/app/api-reference/cli/next)
- [Next.js TypeScript](https://nextjs.org/docs/app/api-reference/config/typescript)
- [Next.js environment variables](https://nextjs.org/docs/app/guides/environment-variables)
- [Next.js file-based app icons](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons)
- [AI SDK OpenAI provider configuration](https://ai-sdk.dev/providers/ai-sdk-providers/openai) (environment naming only; SDK integration is deferred)
- [ESLint release support](https://eslint.org/version-support/) (ESLint 9 lifecycle limitation)
- Prisma 7/PostgreSQL references and schema/seed limitations are listed in [database notes](docs/DATABASE.md).

No deployment or remote repository has been created. Work stops after each authorized phase.
