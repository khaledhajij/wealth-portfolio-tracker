# Wealth Portfolio Tracker

A single Next.js application for stock, crypto and cash holdings in USD, using manual prices, movement-derived quantities and portfolio-scoped permissions. It records holdings; it does not execute trades, settle cash or calculate P&L.

The dashboard and Google Gemini read-only assistant are implemented. **User confirmation on 2026-10-25: the database and live Gemini work, and deployment to Vercel is complete.** Separately, phase 7 agent checks passed 54 tests, typecheck, lint, Prisma validation and build; its database integration commands failed at preflight and it did not run a live provider request. Those historical agent results do not mean the user’s working deployment is blocked. Phase 8 updates documentation only. See [STATUS](docs/STATUS.md) for exact results and limitations.

## Application and features

[Open Wealth Portfolio Tracker](https://wealth-portfolio-tracker-nine.vercel.app)

Deployment to Vercel, database operation and live Gemini operation are user-confirmed. The application uses synthetic assessment accounts and holdings; public registration is disabled. This documentation update does not constitute a new deployment or live verification run.

- Sign in with a seeded account using Better Auth sessions.
- Create an empty USD portfolio and become its Owner; list only portfolios where you have membership.
- View totals, allocation by stock/crypto/cash, position quantities/values and movement history.
- Owners and Editors can add positions, record quantity movements and update manual prices. Viewers have read-only access within their portfolios.
- Price and movement recording times are assigned by the server. Cash unit price is fixed at 1, and stock/crypto quantity changes do not automatically spend cash.
- Use the portfolio-scoped Gemini popup for read-only summaries and positions, with streaming, source figures and Stop controls. Missing AI configuration disables sending without disabling the portfolio features.
- Use responsive forms with pending, empty, success and error states, backed by server-side authorization and Decimal calculations.

Detailed design and deferred features: [PLAN](PLAN.md). Verification evidence and remaining limitations: [STATUS](docs/STATUS.md).

## Prerequisites and stack

- Node.js 24.18.0 and npm 11.16.0, observed in phase 7. The supported ranges are Node >=24.18.0 <25 and npm >=11.16.0 <12; .nvmrc and packageManager record the chosen versions.
- PostgreSQL: the user's earlier Supabase inspector reported 17.11. The user now confirms the database works. The agent’s last connection failed, so it has not independently rechecked current migration/schema state.
- Network access for npm installation and your database. Playwright browser checks need installed Chrome or Chromium.
- Use npm and the existing package-lock.json. Direct dependencies are exact-pinned; do not create another package-manager lockfile.

| Component                                | Installed pin               |
| ---------------------------------------- | --------------------------- |
| Next.js / React / React DOM              | 16.4.3 / 19.3.1 / 19.3.1    |
| TypeScript / Tailwind / ESLint           | 5.9.3 / 4.3.3 / 9.39.5      |
| Prisma CLI / client / pg adapter         | 7.10.1                      |
| pg / Better Auth + Prisma adapter / Zod  | 8.23.1 / 1.7.12 / 4.6.7     |
| AI SDK / React bindings / Google adapter | 7.0.153 / 4.0.157 / 4.0.105 |
| Framer Motion / Lucide React             | 14.6.0 / 1.61.0             |
| Playwright test, development only        | 1.64.1                      |

One App Router app; no Express, Redis, global state library, TanStack Query or Shadcn dependency. Peer/lock compatibility checks are recorded in STATUS. Existing tooling limitations are documented there and in the phase history; pins are not a claim that dependencies never need maintenance.

## Install and private configuration

These are setup instructions, **not commands newly tested in phase 8**. A fresh npm ci was not run in phase 7. Run commands individually and stop on unexpected failures.

From the repository root, in PowerShell:

```powershell
node --version
npm --version
npm ci
if (-not (Test-Path -LiteralPath '.env.local')) {
  Copy-Item -LiteralPath '.env.example' -Destination '.env.local'
}
npm run auth:setup
```

auth:setup fills missing local auth secret/origin/demo-password settings in ignored .env.local, preserves existing values and suppresses them in output. It does not migrate/seed the database. Privately configure the following; never show the file during recording:

| Variable                     | Purpose                                                                                                                                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DATABASE_URL                 | PostgreSQL connection. Percent-encode password characters; never commit/log the URL. Supabase Session pooler on port 5432 is the previously connected user configuration.                    |
| DATABASE_SSL_CA_FILE         | Optional official public CA file path. For the included Supabase CA path use .certs/supabase-ca.crt, after confirming it belongs to your intended project. TLS verification remains enabled. |
| BETTER_AUTH_SECRET           | Random server secret, at least 32 characters; setup generates one if absent.                                                                                                                 |
| BETTER_AUTH_URL              | Exact application origin. Local example: http://localhost:3000. HTTPS required away from loopback. Match the actual port/domain; stale deployment origins reject sign-in.                    |
| DEMO_ACCOUNT_PASSWORD        | Private 12–128-character synthetic seed password; generated if absent. Existing hashes are preserved, not reset by seed.                                                                     |
| GOOGLE_GENERATIVE_AI_API_KEY | Optional private Gemini Developer API key. Never browser-exposed.                                                                                                                            |
| AI_MODEL                     | Explicit Google model available to your project, supporting tools/streaming. No implicit model/fallback.                                                                                     |

Only the empty .env.example is shareable; actual env files, generated output, logs and scratch files are ignored. Prisma CLI/scripts use Next's environment loader, matching .env.local. Server secrets must never be NEXT_PUBLIC_ variables.

When a CA path is configured it must be readable even for config-loading/generation/build commands. The public CA is narrowly allowlisted and traced into server bundles; other certificates/private keys remain ignored. The user confirms Vercel deployment is complete. For subsequent deployments/configuration changes, use the same relative CA path, supply private settings in the intended environment and redeploy after changing them. A path alone does not upload a file. The agent has not validated a successful deployed login or changed deployment settings.

## Inspect migrations before applying

Current migration state is unknown to the agent; the earlier empty-table output is historical and must not be treated as current. For Supabase you may first run the read-only inspector:

```powershell
npm run db:inspect
```

That inspector intentionally expects a Supabase host. For local PostgreSQL, use Prisma status instead. Then:

```powershell
npm run db:validate
npm run db:status
```

Review the current tables/history and these existing SQL migrations:

1. 202610240001_initial
2. 202610240002_invariants
3. 202610240003_auth

If the intended database has only expected pending local migrations, apply them and confirm state:

```powershell
npm run db:migrate
npm run db:status
npm run db:seed
```

db:migrate is prisma migrate deploy, not db push or reset; it does not need a shadow database. A nonzero status may mean pending migrations, connectivity problems or conflicting history: inspect the result before proceeding. Never recreate valid history, drop schemas, modify Supabase-managed schemas or use the application database as a shadow database.

Seed inserts missing synthetic fixtures, checks movement-key conflicts and preserves existing changes/password hashes. A changed private password will not silently reset existing credentials. On a **separate fresh disposable test database**, db:seed twice followed by npm run test:db checks repeatability, constraints, append-only protection and the original 600/200 fixtures. This clean-database procedure was **not run** in the latest review. Do not run test:db expecting original seed totals against an application database whose demo holdings/prices have been edited.

Details: [DATABASE](docs/DATABASE.md), [AUTH](docs/AUTH.md).

## Start and use synthetic accounts

After successful migration/seed:

```powershell
npm run dev
```

Open the Local URL printed by Next.js, normally http://localhost:3000, and use /sign-in. Stop with Ctrl+C. The root redirects to /portfolios; signed-out users are redirected to sign-in. Initial reads need the actual database/session; failures do not produce fake data.

| Email                  | Seeded access                                           |
| ---------------------- | ------------------------------------------------------- |
| owner@example.invalid  | Owner in demo-primary (A), Viewer in demo-secondary (B) |
| editor@example.invalid | Editor in A; no B membership                            |
| viewer@example.invalid | Viewer in A; no B membership                            |
| other@example.invalid  | Owner in B; no A membership                             |

Use your private DEMO_ACCOUNT_PASSWORD, never a documented/shared literal. These .invalid identities and seed holdings are synthetic. Public registration, external OAuth, recovery and invitations are not implemented.

A freshly seeded A contains 10 stock units at $50 plus $100 cash = $600; B contains 0.25 crypto at $800 = $200. Existing rows may differ after edits. Any authenticated user can create an empty USD portfolio and becomes its Owner, even if Viewer elsewhere. New portfolios have zero positions/movements.

Owner/Editor forms create positions, append quantity movements and update prices. UTC recording timestamps are assigned by the server; users cannot edit dates. Cash price stays 1, stock quantity changes do not automatically affect cash, and price changes do not change quantities. Viewer controls are hidden as UX only; services enforce authorization. /account provides identity/sign-out.

## Assistant configuration and behavior

The bottom-right Ask AI popup uses Vercel AI SDK with the direct Google Gemini adapter. Only getPortfolioSummary and listPositions are exposed, using the same secured services as the API. OpenAI/ChatGPT Plus is not the application provider; no OpenAI key or AI Gateway fallback is used.

If either Google key or AI_MODEL is missing, sending is disabled with a clear server-configuration message; an otherwise authorized chat request receives 503. Portfolio features do not require an AI key. There are no canned responses or fake database substitutions. With both settings present, the UI says configuration was detected; that does not prove provider availability. Restart after local environment changes.

Each request sends only its latest question and validated portfolio selection. Server/session context is rechecked for every read tool; the model cannot choose a user/role or execute writes/SQL/shell. Exact server numbers/manual timestamps appear in source cards. Streaming, Stop, close cancellation, portfolio reset, sanitized errors and time/size limits are implemented; prose may still be inaccurate. Use synthetic data only for assessment demonstrations. The user confirms live Gemini works. The agent has not independently run a live request or checked a response/model/quota; this is user-confirmed operation, separate from the controlled tests.

See [ASSISTANT](docs/ASSISTANT.md) for contracts, limits and testing boundaries.

## Verification commands and actual evidence

Run these from the repository root; the table reports phase 7 evidence, not a new phase 8 runtime run.

| Command                                                    | Actual latest recorded result                                                          |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| npm test                                                   | Passed: 54 tests, 0 skipped; explicit DB/session/model doubles where documented        |
| npm run typecheck                                          | Passed                                                                                 |
| npm run lint                                               | Passed                                                                                 |
| npm run db:validate                                        | Passed; schema syntax only                                                             |
| npm run build                                              | Passed; does not establish DB/provider connectivity                                    |
| npm run db:inspect                                         | Failed: timeout/termination                                                            |
| npm run db:status                                          | Failed: exit 1, no actionable state captured                                           |
| npm run test:api                                           | Failed at read-only migration preflight; functional SQL scenarios not run              |
| npm run test:auth                                          | Failed at read-only migration preflight; real session/seed scenarios not run           |
| npm run test:ui                                            | Failed at read-only migration preflight; authenticated journey not run                 |
| npm run db:migrate / db:seed / test:db on a fresh database | Not run in phase 7; clean migration/seed acceptance remains pending                    |
| Live Google provider / Vercel deployment                   | User-confirmed working / completed on 2026-10-25; no new agent live test or deployment |
| Valid deployed login as a separate acceptance check        | Not run by agent; not separately asserted in the latest user message                   |

The user previously supplied phase 4 HTTP PASS output for permissions, 600 -> 700, exact fractions, replay/actor checks and overlapping decreases: two blocked SQL requests, one -8 accepted from 10, final quantity 2, plus identical-key insertion once. That is historical user-terminal evidence, not a rerun against today's tree.

Production-mode local startup:

```powershell
npm run build
npm start
```

The build and local production server were exercised during phase 7 negative HTTP checks. For current real integrations, build first, then run test:api/test:auth/test:ui from a connected terminal. API/UI verifiers create new labeled synthetic records that remain for audit; they never reset existing holdings. Auth verification may insert missing demo fixtures/credentials and rolls back financial scenarios. Review their documented effects first. Browser checks use installed Chrome/Chromium; if neither is available, npx playwright install chromium is a setup instruction, not a newly tested command.

Phase 7 also passed local anonymous HTTP, explicit component-only forms/mobile and controlled-SSE popup checks. Their scratch helpers under ignored tmp are not shipped/reproducible project scripts and do not prove live authenticated database/provider behavior. Main reproducible checks are the package scripts above. Full check/command/result/limitation table: [STATUS](docs/STATUS.md).

## Design, limitations and submission

Start with [PLAN](PLAN.md) for entities, permissions, valuation, transactions and trade-offs. Core implementation: lib/server/portfolio-service.ts, valuation.ts, auth.ts, assistant.ts, assistant-tools.ts; UI under app/portfolios. Remaining verification gaps include runtime DB privileges/RLS/Data API exposure and deployed auth-origin checks, process-local auth limits, the rememberMe expiry discrepancy, clean-database/current SQL/browser acceptance and live-provider failure/limit behavior. Database/Gemini operation and Vercel deployment are user-confirmed; large-portfolio scaling is deferred.

[AI_USAGE](docs/AI_USAGE.md) distinguishes agent implementation/testing from user-provided evidence. [VIDEO_OUTLINE](docs/VIDEO_OUTLINE.md) contains the 13-minute walkthrough, source line references, Q&A and user-operated submission checklist.

Configured Git origin: https://github.com/khaledhajij/wealth-portfolio-tracker.git. This was read locally in phase 8; remote existence, visibility and reviewer permissions were not checked. Video link: **Not created yet**. The user confirms Vercel deployment is complete and database/Gemini operation works. Valid deployed login is not a separately rerun agent acceptance check. No upload, publication, repository permission change or email is performed by this documentation phase.
