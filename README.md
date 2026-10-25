# Wealth Portfolio Tracker

Talent Syria assessment prototype. **Phase 6 read-only streaming assistant implemented locally; live-provider and fresh authenticated database/browser acceptance are pending. Phase 4 API acceptance passed in the supplied user-terminal run.**

Authenticated users can create an empty USD portfolio from `/portfolios`. Each creation atomically adds that user's Owner membership; being a Viewer elsewhere does not restrict this. No new migration or seed is required. Run `npm run build` then `npm run test:ui` from a database-connected terminal to verify creation/rollback/isolation and the dashboard journey; current agent results are in STATUS.

The home page redirects to `/portfolios`, which uses the existing session-protected dashboard and sends signed-out users to `/sign-in`. Portfolio detail shows session-scoped holdings, allocation, movement history and manual-price forms. Use the bottom-right **Ask AI** button to open its portfolio-scoped popup; missing server AI configuration disables sending. No canned AI or database fallback. See [assistant setup/limits/evidence](docs/ASSISTANT.md), [dashboard](docs/DASHBOARD.md), [API](docs/API.md), [authentication](docs/AUTH.md), [PLAN](PLAN.md), [STATUS](docs/STATUS.md), and [AI usage](docs/AI_USAGE.md).

## Prerequisites and package manager

- Node.js **24.18.0** and npm **11.16.0**, the versions used for this phase. `.nvmrc` records Node; `package.json` declares the supported Node 24/npm 11 ranges and package manager. A Node version manager is optional; Windows PowerShell is supported.
- Network access to the npm registry for initial installation and the platform-specific Next.js/Tailwind compiler packages. No global Next.js CLI is needed.
- A reachable PostgreSQL **17.x** database: the user's Supabase inspector reported **17.11**. A local PostgreSQL server/psql is an alternative, not required when using Supabase. See [database setup](docs/DATABASE.md). The generated client, unit tests and build need no running database or AI key. Dashboard data requires the configured database and authentication.

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
| Better Auth / Prisma adapter | 1.7.12 |
| Zod | 4.6.7 |
| AI SDK / React / Google adapter | 7.0.153 / 4.0.157 / 4.0.105 |
| Framer Motion / Lucide React | 14.6.0 / 1.61.0 |
| Playwright test (development only) | 1.64.1 |

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

Database/authentication require private environment settings. Copy the template **only if `.env.local` does not already exist**:

```powershell
Copy-Item .env.example .env.local
```

- `DATABASE_URL`: private PostgreSQL connection for Prisma CLI and internal scripts. URL-encode password characters; never paste the URL into chat/logs.
- `DATABASE_SSL_CA_FILE`: optional path to the official Supabase CA downloaded from Database Settings > SSL Configuration. Save it as `.certs/supabase-ca.crt` and set this variable in `.env.local` to `.certs/supabase-ca.crt` when certificate trust fails. The folder is ignored; certificate verification stays enabled. See [TLS setup](docs/DATABASE.md).
- `BETTER_AUTH_SECRET`: random server secret of at least 32 characters; `npm run auth:setup` generates it locally if missing.
- `BETTER_AUTH_URL`: exact application origin, normally `http://localhost:3000` for local development. Non-loopback environments require HTTPS and Secure cookies.
- `DEMO_ACCOUNT_PASSWORD`: private 12-128-character password used to seed the four synthetic accounts. `auth:setup` generates a random value if missing; read it privately in `.env.local`, never paste it into chat or commit it. Existing credentials are preserved, not reset by seed.
- `GOOGLE_GENERATIVE_AI_API_KEY`: private Gemini Developer API key created in [Google AI Studio](https://aistudio.google.com/apikey), used through Vercel AI SDK's direct Google adapter. No AI Gateway or key sent to the browser. The old OPENAI_API_KEY is no longer read.
- `AI_MODEL`: explicit tool/streaming-capable model available in your API project; no implicit model is selected. Both AI values are needed to enable the assistant; restart after changes. Configuration does not prove live availability. Use synthetic demo data only.

All template values are empty. Prisma config/scripts use Next's environment loader to respect `.env.local`. These names are server-only: never add `NEXT_PUBLIC_` to credentials. `.gitignore` excludes `.env*` except `.env.example`, generated Prisma/build output, local logs and dependencies. Keep actual credentials out of Git and browser code. Chat setup, read-tool contracts, limits, cancellation and unverified live checks are documented in [ASSISTANT](docs/ASSISTANT.md).

Supabase is configured privately in `.env.local`. The user-terminal inspector now reports an authenticated PostgreSQL **17.11** session, empty `public` tables and no Prisma migration history. The agent's separate connection still times out. Phase 2 is **not complete**: migration application, seed repeatability and database acceptance have not been verified. From the terminal where inspection succeeds, run the following commands individually, stopping on any unexpected failure or conflicting migration state:

```powershell
npm run db:status
# Pending local migrations are expected; conflicts/connection errors are not.
npm run auth:setup
npm run db:migrate
npm run db:inspect
npm run db:status
npm run db:seed
npm run db:seed
npm run test:db
npm run test:auth
```

There are now **three** migrations: the original two plus additive `202610240003_auth`. Before applying them, inspect current tables/history again; the user's empty-database result is an earlier snapshot. `db:status` may report pending migrations and return a nonzero exit code; conflicting history or connection errors require diagnosis before proceeding. After applying, all three should be finished with matching local checksums. `db:migrate` uses `prisma migrate deploy`, which needs no shadow database; do not use reset/db push. Run commands individually and stop on errors. See [database safeguards](docs/DATABASE.md).

Once migrations and seed succeed, run `npm run dev`, open `/sign-in`, and use `owner@example.invalid`, `editor@example.invalid`, `viewer@example.invalid` or `other@example.invalid` with your private `DEMO_ACCOUNT_PASSWORD`. Sign-in opens your portfolio list. Open a portfolio to inspect its actual role/valuation/history. Owners/Editors can create a zero-balance position, record a movement or update a manual price; Viewer controls are absent and server authorization remains mandatory. `/account` retains identity/sign-out information. Sign out before using another account. No public registration, OAuth or email setup is required.

For phase 5 browser acceptance, run `npm run build` then `npm run test:ui` from the terminal with working database connectivity. It uses real sign-in/forms and its own server plus a new synthetic verification portfolio, without resetting existing holdings. Playwright 1.64.1 is a pinned dev dependency. If neither bundled Chromium nor standard Windows Chrome is available, run `npx playwright install chromium`. Full commands, test-data behavior and verified/unverified distinctions: [DASHBOARD](docs/DASHBOARD.md). No migration or additional runtime UI/state library is needed.

Phase 4 adds GET `.../summary`, GET `.../positions` and PATCH `.../positions/:positionId/valuation`; existing POST positions/movements and position PATCH remain. Position creation now returns 201. Portfolio errors add a stable `code` alongside `error`. Inputs/DTOs and exact session/membership/resource checks are documented in [API](docs/API.md).

After a fresh `npm run build`, use `npm run test:api` for the real HTTP/database suite. It verifies migration history before writes, uses real demo sessions, starts its own loopback server, and leaves new labeled synthetic verification portfolios/history without resetting existing demo data. The user supplied all functional PASS lines: two blocked SQL requests observed, one decrease of 8 accepted from quantity 10, the other rejected, final quantity 2; simultaneous identical keys insert once and return the same DTO. This is user-terminal evidence; the agent's own attempt failed at read-only preflight. No migration/schema/dependency/UI changes were needed in phase 4. Existing auth-rate-limit/runtime-privilege limitations remain in AUTH/STATUS; no production-readiness claim is made.

## Checks and production-mode local run

```powershell
npm run lint
npm run typecheck
npm run build
npm start
```

Lint runs ESLint directly (Next.js 16 removed `next lint`). Typecheck generates Prisma/Next types then runs TypeScript. Build generates Prisma Client before compiling; `npm start` serves the build locally. None applies migrations or proves database access. `npm test` covers Decimal arithmetic, service permission denials/allowed writes, strict input rules, retry semantics, cookies configuration and library hashing with explicit test doubles for DB/session dependencies. `test:db` and `test:auth` require the configured prototype database and remain unverified here. The auth verifier first checks migration history/checksums; it then seeds synthetic credentials, uses actual library sessions, and rolls back financial test scenarios. See [AUTH](docs/AUTH.md) and [STATUS](docs/STATUS.md).

## Code flow and decisions

- `app/layout.tsx` provides the document, metadata and global CSS; `app/page.tsx` serves `/` as a Server Component.
- `app/icon.svg` supplies a small local browser-tab icon through Next.js's file-based metadata convention.
- `app/globals.css` imports Tailwind 4; `postcss.config.mjs` enables its PostCSS plugin. There is no Tailwind 3 config or `@tailwind` directive setup.
- `next.config.ts`, `tsconfig.json`, and `eslint.config.mjs` keep framework/compiler/lint settings explicit. Next.js generates the ignored `next-env.d.ts` and `.next/` types during checks/startup.
- This is one Next.js application. No Express, Redis, state library, Shadcn components or chat was added. Package ESM mode allows TypeScript CLI scripts to use normal ESM imports/top-level await through tsx.
- `prisma.config.ts`/`prisma/schema.prisma` use Prisma 7's config URL, explicit generated client output and PostgreSQL driver adapter. `lib/server/` contains server-only database/valuation code. Generated files are ignored and regenerated by build/typecheck/tests.
- `session.ts` derives identity from Better Auth; `portfolios.ts` binds it to server-only portfolio services. Each read/write checks Membership and scoped resource IDs. APIs return private/no-store responses; financial mutations require same-origin JSON. No request body/header chooses identity or role. The old actor-ID valuation helper now lives only in scripts for phase 2 fixture checks; production valuation uses the session-bound service.
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
- [AI SDK Google provider configuration](https://ai-sdk.dev/providers/ai-sdk-providers/google), [Google API key setup](https://ai.google.dev/gemini-api/docs/api-key); version-specific streaming/UI/testing references in [ASSISTANT](docs/ASSISTANT.md).
- [ESLint release support](https://eslint.org/version-support/) (ESLint 9 lifecycle limitation)
- Prisma 7/PostgreSQL references and schema/seed limitations are listed in [database notes](docs/DATABASE.md).
- Better Auth 1.7.12 official integration/schema/security documentation and installed-source checks are recorded in [AUTH](docs/AUTH.md).

No deployment or remote repository has been created. Work stops after each authorized phase.
