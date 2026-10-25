# Phase 3 authentication and authorization

## Choice and actual compatibility

Selected Better Auth **1.7.12** and `@better-auth/prisma-adapter` **1.7.12**, exact-pinned in npm's existing lockfile. No earlier auth integration existed. npm's package metadata supports Next 14/15/16, React 18/19 and Prisma/client 5/6/7; the installed Next 16.4.3, React 19.3.1 and Prisma 7.10.1 satisfy those ranges. Zod **4.6.7** validates server write contracts.

Better Auth supplies password hashing/verification, signed session cookies, database session expiration/revocation, request-origin checks and a Prisma adapter. We use its email/password method to avoid external OAuth or a custom session implementation. The minimal server entry avoids loading unused database integrations. The standalone Prisma adapter is explicitly installed.

Official documentation was read and cross-checked against installed 1.7.12 declarations and crypto implementation:

- [Installation](https://better-auth.com/docs/installation): secret/base URL and handler setup.
- [Prisma integration](https://better-auth.com/docs/adapters/prisma): explicitly covers Prisma 7 and existing generated-client/adapter setup.
- [Next.js integration](https://better-auth.com/docs/integrations/next): request handler and `api.getSession` with request headers. We use client HTTP handlers for sign-in/out, so no server-action cookie plugin is needed.
- [Email/password](https://better-auth.com/docs/authentication/email-password) and [options](https://better-auth.com/docs/reference/options): disable sign-up and use credentials.
- [Core database schema](https://better-auth.com/docs/concepts/database): User/Session/Account/Verification; credential accountId is the stable User ID.
- [Sessions](https://better-auth.com/docs/concepts/session-management), [cookies](https://better-auth.com/docs/concepts/cookies) and [security](https://better-auth.com/docs/reference/security): database-backed sessions, cookie attributes, hashing and CSRF behavior.
- [Next.js 16 authentication/DAL guidance](https://nextjs.org/docs/app/guides/authentication).
- [Prisma **7** transactions](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions): interactive serializable transactions and P2034 retry handling. The unversioned page currently describes Prisma 8; those APIs were not copied.
- [Zod 4.6 schemas](https://zod.dev/api): strict objects and ISO timestamp validation.

## Setup and migration safety

Keep DATABASE_URL and optional official CA path in ignored `.env.local`. Run `npm run auth:setup` to generate only missing local auth values; it never prints them or replaces configured values. The local secret/password were generated in this session. Open `.env.local` privately to see the demo password. Do not paste it into logs/chat. The empty `.env.example` remains shareable.

`BETTER_AUTH_URL` must be the exact origin used in the browser. HTTP is allowed only for loopback (`localhost`, `127.0.0.1`, IPv6 loopback); every remote origin requires HTTPS. Cookies are HttpOnly, SameSite=Lax, host-scoped, path=/, Secure on HTTPS. This explicit loopback exception also supports `npm start` locally. There are no cross-subdomain cookies or wildcard trusted origins.

### Vercel 403 INVALID_ORIGIN

The user's deployed sign-in endpoint returned 403/INVALID_ORIGIN on 2026-10-25 when probed with its actual browser origin and a synthetic nonexistent account/dummy password. This confirms that deployment does not currently trust the accessed domain; it does not verify valid credentials or database-backed sessions. The project explicitly sets both Better Auth baseURL and trustedOrigins from the server's BETTER_AUTH_URL.

In Vercel Project Settings > Environment Variables, set the **Production** value to the exact origin used by the user:

```dotenv
BETTER_AUTH_URL=https://wealth-portfolio-tracker-nine.vercel.app
```

No /sign-in or /api/auth suffix and no localhost value for this deployment. Create a new Production deployment after saving, and access that same domain when retrying. Preview deployments need their own explicitly intended origin/configuration; do not solve an origin mismatch by trusting every vercel.app site or disabling CSRF/origin/cookie protections. Keep BETTER_AUTH_SECRET private and unchanged for this fix; changing the demo password env does not update existing seeded password hashes. No password reset, reseed, auth bypass or authentication-code change is required to resolve the observed origin rejection. A subsequent valid login remains to be checked after the environment fix.

References: [Better Auth origin protection](https://better-auth.com/docs/reference/security), [Vercel environment changes require new deployments](https://vercel.com/docs/environment-variables).

`202610240003_auth` is additive. It extends User, creates the library's Session/Account/Verification tables and adds nullable Position.priceUpdatedBy. Existing user IDs, memberships, positions, movements and the two earlier SQL files are preserved. Existing prices have no invented actor; new service writes set the session actor. No Supabase auth/storage schemas or dashboard settings are changed. Only Prisma migrations are used, not Better Auth's built-in database migrator, db push or reset.

From a terminal with working database access, run individually:

```powershell
npm run db:inspect
npm run db:status
npm run auth:setup
# Review pending migrations/history before proceeding.
npm run db:migrate
npm run db:inspect
npm run db:status
npm run db:seed
npm run db:seed
npm run test:db
npm run test:auth
npm run dev
```

Pending migrations on an otherwise matching database are expected. Stop for history/checksum conflicts or other failures. `migrate deploy` needs no shadow database. Never use this application database as a development shadow.

Seed retains the four `.invalid` identities and their existing memberships. `Account.password` contains Better Auth's independently salted scrypt hashes, not plaintext; `providerId=credential`, `accountId=user.id`. Repeated seeding verifies existing credentials against the configured password and preserves hashes. A different configured password causes a safe failure rather than resetting credentials. Domain seed and credential seed are separate transactions; if credential seed fails, already-created synthetic domain fixtures can remain and be reused safely on retry. No temporary sessions, fake user headers, role switcher, public registration or email/OAuth requirement.

## Runtime flow

1. `/sign-in` submits email/password using the library's same-origin client. Only its sign-in, sign-out and get-session paths are exposed by our catch-all auth handler. Other auth lifecycle routes return 404; library sign-up is also disabled. No account/membership administration endpoints exist.
2. The library checks the stored hash and issues its signed, opaque session cookie. Sessions are stored in PostgreSQL. The configured expiresIn is eight hours, but the current sign-in form passes rememberMe=false; installed Better Auth 1.7.12 overrides that case to a 24-hour database expiry and a nonpersistent cookie (dist/db/internal-adapter.mjs, createSession). This discrepancy was identified during the explanation follow-up; phase 4 does not change authentication behavior. Automatic refresh and cookie session caching are disabled. The seed password stays in private server configuration and is entered manually; it is never prefilled or bundled.
3. `session.ts` passes Next request headers to the library, validates the session and returns only user.id. `/account` performs its own check; redirecting there does not protect APIs by itself. Each service invocation validates the session again.
4. `portfolios.ts` is the production composition of the DB client, trusted session reader and server-only service. No production method accepts actorId/role. The factory injection seam is for server tests only. The older actor-ID fixture reader was moved under scripts; production valuation calls the authenticated service.
5. Membership is deny-by-default: OWNER/EDITOR/VIEWER read; only OWNER/EDITOR write. Missing sessions -> 401; member with inadequate write role -> 403; absent membership, unknown role or foreign resource -> generic 404. Position and movement access always constrain portfolioId as well as positionId. DTOs contain no hashes, credentials or session tokens.

All private API responses set `Cache-Control: private, no-store` and `Vary: Cookie`; private pages are dynamic. No React/Next shared result cache is used. Reusing a Prisma connection pool is not caching portfolio data. Origin checks and an 8 KiB actual-body limit protect JSON financial mutation routes in addition to the library's auth-origin protections.

Historical phase 4 finding: disableIpTracking=true caused Better Auth 1.7.12 to skip its configured limiter. **Fixed in phase 7:** tracking is enabled for rate-limit resolution, while a session-create database hook sets ipAddress=null before persistence. No raw address is written to sessions by this path. Only x-vercel-forwarded-for is trusted when the server's VERCEL environment flag is 1; elsewhere forwarded headers are ignored and the library falls back to a shared per-path bucket (loopback in development/test). Sign-in uses 10 attempts per 60 seconds; other configured routes retain 30 per 60 seconds, subject to library-specific rules. Handler regression tests prove 429 after the limit and rejection of spoofed forwarding-header bucket resets; a persistence double verifies address removal. See [Better Auth options/hooks](https://better-auth.com/docs/reference/options) and [Vercel request headers](https://vercel.com/docs/headers/request-headers), checked alongside the installed source.

The limiter remains memory-backed and process-local: cold starts/multiple instances do not share counters. The off-Vercel production fallback shares a bucket among users. Actual deployed proxy behavior, distributed protections and runtime privilege hardening remain unverified; this narrow fix does not establish production brute-force protection across a deployment. Direct server auth.api calls are outside HTTP rate limiting. The existing rememberMe expiry discrepancy above is unchanged.

## Services and endpoints

| Endpoint                                                 | Service behavior                                                                   |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| GET `/api/portfolios`                                    | List only current user's memberships                                               |
| GET `/api/portfolios/:portfolioId`                       | Authorized positions, movement-derived quantities and Decimal valuation            |
| POST `/api/portfolios/:portfolioId/positions`            | Owner/Editor adds a zero-balance position; no implicit movement or cash settlement |
| GET `/api/portfolios/:portfolioId/positions/:positionId` | Read only a position belonging to this portfolio                                   |
| PATCH same position path                                 | Owner/Editor updates manual price/time and priceUpdatedBy                          |
| GET position path + `/movements`                         | Authorized latest 100 history rows (bounded prototype read, no pagination yet)     |
| POST position path + `/movements`                        | Owner/Editor appends a signed movement with session-derived createdBy              |

Phase 4 also exposes GET portfolio `/summary`, GET `/positions` and PATCH position `/valuation`, retaining the previous PATCH alias. Position creation returns 201; portfolio errors add stable codes. See [API.md](API.md) for current contracts, transaction/retry details and real HTTP concurrency verification. No UI expansion or new auth integration was added.

Write contracts use decimal strings, not JS money numbers; reject excessive scale/range, negative prices, zero deltas, future timestamps and unknown fields including userId/role/createdBy. Cash is USD at price 1 and cash movements accept cents only. Services use serializable transactions, lock membership and target position rows, check the resulting balance and retry P2034 up to three attempts. Negative balances and aggregate quantities >= 10^18 are rejected. Request-key retries must match portfolio/position/actor/quantity/time/note; conflicting payloads return 409. Same-position concurrent retries serialize through the row lock; globally conflicting keys on other positions are rejected by uniqueness. Database triggers still protect append-only history.

## Evidence and remaining blockers

Local unit tests use explicitly labeled session/DB test doubles to check all required denials, allowed roles and domain rules. They also invoke the library's real password hashing. These are not evidence of successful PostgreSQL sign-in. See STATUS for command results and browser checks.

`npm run test:auth` is the real PostgreSQL/library verification: migration checksums before writes; repeat credential seed and unchanged hashes; correct/wrong credentials; disabled registration; cookie attributes; member reads/Viewer/nonmember/foreign-ID denials; successful Owner/Editor writes and retry conflict checks inside a rolled-back transaction; forged/expired sessions, cross-origin sign-out rejection and logout revocation. It revokes only the sessions it created. Synthetic seed remains; financial scenario changes roll back. The transaction wrapper used by this script exercises sequential service behavior, not concurrent transaction scheduling.

Current execution stops at the read-only migration preflight because the agent connection still fails. No successful credential session, DB-backed role write, schema application or actual concurrent withdrawal test is claimed. User-terminal connectivity previously succeeded, but migration/seed results have not been supplied. Phase 2 database acceptance and phase 3 live acceptance remain open. No fake identity is substituted on failure.

Before any remote exposure, resolve the existing runtime DB owner/RLS/Data API privileges from DATABASE.md. No managed-role changes were authorized/performed. Distributed rate limits, account recovery, membership management, dashboard/forms and AI remain deferred. No remote repository/deployment/email was created.
