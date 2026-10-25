# Wealth Portfolio Tracker: design and delivery plan

Updated: 2026-10-25, phase 8 documentation handoff. Deadline supplied by the user: end of Sunday, October 25, 2026, Damascus time.

This document describes the current design, selected scope and deferred work. [STATUS](docs/STATUS.md) classifies implementation and verification separately. [AI_USAGE](docs/AI_USAGE.md) preserves the development record; [VIDEO_OUTLINE](docs/VIDEO_OUTLINE.md) prepares the walkthrough. The user confirms on 2026-10-25 that the database and live Gemini work and Vercel deployment is complete. This operational confirmation is separate from clean-database, detailed security and provider-failure acceptance checks; the agent did not independently rerun them.

## Requirements versus our choices

The original assessment PDF is absent from the current workspace. Its phase 0 requirement notes are preserved here; it was not reread during phase 8.

| Source                                        | Requirement recorded                                                                                                                                                                           | Our response / decision                                                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| PDF, phase 0 record                           | Build an intentional prototype/subset; prioritize understanding and architectural reasoning.                                                                                                   | A small holdings tracker with manually recorded prices and explainable service boundaries.                                |
| PDF, phase 0 record                           | Reference technologies and candidate capabilities are options, not a requirement to implement everything.                                                                                      | Single Next.js application; defer realtime, queues and market integrations.                                               |
| PDF, phase 0 record                           | Clear written plan and repository setup; a voiced 10–15 minute screen recording covering scope, AI, permissions, trade-offs and agent-assisted development; reply with repository/video links. | README, design/status/usage docs and a 13-minute outline. Recording/upload/email remain user actions.                     |
| User foundation and subsequent phase requests | App Router, React, TypeScript, PostgreSQL, Prisma, Zod, Tailwind and Vercel AI SDK; USD stock/crypto/cash; append-only movements; server authorization; read-only AI.                          | Implement these boundaries in the existing app. No Express, Redis, global state library or market feed.                   |
| Later user decisions                          | Authenticated portfolio creation; server-generated price/movement recording time; Google API instead of OpenAI; popup matching dashboard.                                                      | Atomic Portfolio + Owner creation; strict timestamp-free write contracts; direct Google Gemini adapter; accessible popup. |

No feature or security claim comes solely from the assessment wording. The PDF notes above are historical evidence, not a fresh document review. Remote repository/deployment activity is not authorized by this plan; a configured Git origin and previously reported deployment are described factually in README.

## Product journey

1. Sign in using a seeded synthetic account and a real Better Auth session. Public registration and external OAuth are disabled.
2. See only membership-accessible portfolios. Any authenticated user may create an empty USD portfolio; creation atomically gives that user an Owner membership.
3. Open the dashboard: portfolio name, current role, total value, asset allocation, positions and latest 100 movements. No database failure is replaced by fake balances.
4. Owners/Editors add a zero-quantity position, then append positive/negative quantity adjustments. Recording stock holdings does not spend cash.
5. Owners/Editors update manual unit prices. New prices/movements receive server UTC recording time; dates cannot be supplied by the client. Historical timestamps remain unchanged.
6. Use the read-only Ask AI popup for selected-portfolio summary/positions when both Google settings are present. Without them, sending is disabled with a configuration message. Errors/Stop/cancellation are explicit.

This is recorded holdings and current manual valuation, not orders, purchases, cost basis, P&L or financial advice.

## Single-application design and trade-offs

- Server Components read the secured services directly for initial portfolio list/detail data. Client Components own dialogs, pending/errors and chat interactions, call Route Handlers, and refresh server data after success. Totals are not independent client state.
- Route Handlers are adapters. The same server-only portfolio service checks sessions, membership and resource scope for HTTP, Server Components and AI reads. Layout/hidden controls are presentation, never authorization.
- Better Auth 1.7.12 with its Prisma adapter supplies password hashing and database-backed sessions. Existing synthetic domain identities are reused; no temporary/homegrown session system.
- Prisma 7.10.1 uses explicit generated client output, pg adapter and prisma.config.ts. Next's environment loader serves application/CLI scripts. SQL migrations retain constraints/triggers that Prisma schema syntax cannot express.
- Zod strict objects reject extra identity/role/time fields. Decimal strings cross API boundaries; cloned Decimal constructors isolate high-precision financial calculations.
- Tailwind 4 plus authored CSS and native dialogs keep the UI small. Existing React/Next mechanisms suffice; no TanStack Query, state library or Shadcn installation was needed.
- AI SDK 7 with @ai-sdk/google calls Google Gemini directly. Chat is request-local, bounded and read-only; no AI Gateway, OpenAI fallback or persistent conversation store.
- Trade-offs: read services currently load all position movements to calculate a portfolio; history display is capped at 100, tool position output at 10. This favors explainability over large-portfolio scalability.

## Entities and invariants

| Entity                               | Purpose / invariant                                                                                                                                                                                                     |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User, Session, Account, Verification | Better Auth identity/session/credential integration. Account passwords are salted library hashes; secrets and raw seed passwords are never browser config.                                                              |
| Portfolio                            | Named USD container. No initial positions/movements are inserted on creation.                                                                                                                                           |
| Membership                           | User + portfolio + Owner/Editor/Viewer; unique (userId, portfolioId). Role belongs to that portfolio only.                                                                                                              |
| Position                             | Portfolio, STOCK/CRYPTO/CASH, label/symbol, Decimal(28,8) manual unitPrice, priceAsOf, price actor and timestamps. Unique portfolio/type/symbol. Cash requires USD symbol and price 1.                                  |
| PositionMovement                     | Composite position/portfolio reference, nonzero Decimal(28,10) signedQuantity, trusted createdBy, occurredAt, note, globally unique requestKey. Append-only SQL triggers forbid update/delete/truncate by ordinary SQL. |

Three existing migrations: 202610240001_initial, 202610240002_invariants, 202610240003_auth. Do not recreate them, reset the application database or replace migrations with db push. Database owner privileges can bypass triggers: runtime grants and Supabase Data API/RLS exposure remain a release risk requiring verification.

## Permission matrix

| Operation                                                    | Owner                                               | Editor   | Viewer   | Nonmember / no session |
| ------------------------------------------------------------ | --------------------------------------------------- | -------- | -------- | ---------------------- |
| Read selected portfolio, positions/history/summary; AI reads | Yes                                                 | Yes      | Yes      | Denied                 |
| Add position, append movement, update price                  | Yes                                                 | Yes      | No       | Denied                 |
| Create own USD portfolio                                     | Any authenticated user, regardless of existing role | Same     | Same     | No session: denied     |
| Assign/change memberships, transfer/delete portfolios        | Deferred                                            | Deferred | Deferred | Denied                 |

Identity comes from the verified session, not request userId/ownerId/role/header claims. Resource queries constrain portfolioId and positionId. Missing session produces 401, inadequate write role 403, inaccessible/missing resources generic 404. Strict contracts may reject malformed input before an access check; no protected data is returned. Financial browser mutations require same-origin JSON with an actual 8 KiB body cap. Private responses are no-store; no shared portfolio-result cache exists.

The phase 7 auth limiter fix enables library request limiting while stripping IP from session persistence. Sign-in is limited to 10 requests/60 seconds per bucket. On Vercel, only its platform forwarding header is trusted; elsewhere the library fallback is shared. Counters are process-local, not distributed. The documented rememberMe=false library behavior uses 24-hour DB expiry despite configured eight-hour expiresIn.

## Quantity, valuation and timestamp semantics

quantity(position) = sum of its signed movement quantities.

value(position) = quantity × current manual unitPrice.

portfolio total = sum of position values; allocation = value / total × 100, or zero when total is zero.

Server calculations use 80-significant-digit Decimal arithmetic. Prices accept at most 20 integer/8 fractional digits; movements 18 integer/10 fractional digits, nonzero. Cash deltas must fit cents; resulting holdings cannot be negative or reach 10^18. Exact values serialize as decimal strings; display total rounds once to cents, half-up.

Synthetic example: 10 stock units × $50 + $100 cash = $600. Append +2 stock units: 12 × $50 + $100 = $700; cash stays $100. Updating that stock price to $60 then gives $820 with quantity still 12. Fractional example: (0.1 + 0.2) × 0.1 = 0.03.

priceAsOf/occurredAt retain their schema/DTO names, but new writes mean server recording time, not independently observed market/event time. The client cannot backdate them. A recent recording does not establish quote freshness. Historical prices/portfolio values cannot be reconstructed from the current-price column alone.

## Write transactions and retries

Portfolio creation inserts Portfolio and the creator's Owner Membership in one transaction; a failure rolls back both.

Position/movement/price writes use serializable transactions: lock Membership FOR SHARE, verify role, then lock the selected Position FOR UPDATE where relevant. Movement balance aggregation and insertion share the transaction. Row locks alone do not refresh an earlier serializable snapshot; serialization/deadlock conflicts retry the entire transaction with a new snapshot, at most three attempts.

The unique requestKey guards movement duplication. Replay compares portfolio, position, trusted actor, Decimal quantity and note, then returns the original DTO/timestamp. Conflicting reuse returns 409; unique races retry in a new transaction. No update to immutable history and no implicit cash mutation. Portfolio creation itself has no idempotency key: check the list after an ambiguous response before retrying.

## Assistant boundary and limits

POST /api/chat accepts only portfolioId and message. The selected ID is untrusted input: the server validates session/membership before constructing a provider, then binds a frozen user/portfolio context. The model receives no identity/role/scope arguments.

| Tool                | Small result                                                                                      | Authorization                                                   |
| ------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| getPortfolioSummary | Server total/display total, count, three allocation groups, oldest/newest manual-price timestamps | Recheck bound context and call the same secured summary service |
| listPositions       | At most 10 positions with exact quantity/price/value/timestamp and hasMore                        | Recheck bound context and call the same secured list service    |

No SQL, shell, unrestricted HTTP, write tool or AI history reader is exposed. Labels/symbols/prompts are untrusted; prompts guide prose, capability/service boundaries enforce security.

Limits: 2,000 question characters, 8 KiB body, three steps, 600 output tokens per step, four tool reads, sequential tool execution, 30-second overall deadline, 15-second step and 10-second chunk timeouts, zero provider retries. UI caps six questions per popup conversation; each request sends only its latest question. Closing/Stop/unmount cancels work; switching portfolio resets local chat. Abort prevents later reads reaching the provider but cannot necessarily cancel an already-started database query. Provider errors are sanitized. Source cards remain authoritative; prose can be inaccurate.

## Implementation order and remaining gates

| Phase   | Delivered scope                                                  | Current gate                                                                                                                     |
| ------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0–1     | Plan/foundation, pinned single app, config/setup                 | Current code exists; fresh clean install not rerun in phase 7/8                                                                  |
| 2       | Schema/migrations/synthetic seed/Decimal calculations            | Database operation user-confirmed; clean migration/seed acceptance still needs a fresh dedicated database                        |
| 3–4     | Library auth, secured services/API, isolation/replay/concurrency | Earlier user HTTP/concurrency PASS output exists; fresh agent integrations failed at migration preflight                         |
| 5 / 5.5 | Dashboard, forms, portfolio creation/list/empty state            | UI implemented; component tests pass; detailed authenticated browser acceptance not rerun by agent                               |
| 6       | Gemini read-only tools/streaming/popup                           | SDK/control tests pass; live Gemini operation user-confirmed; no independent agent live call                                     |
| 7       | Review and narrow auth limiter fix                               | 54 tests + static/build pass; clean SQL/security/provider edge-case verification gaps remain; user confirms operation/deployment |
| 8       | Current design/setup/status/video handoff                        | Documentation only; recording/upload/reviewer access/email are user tasks                                                        |

Implemented/partial/planned classifications and passed/failed/not run evidence are consolidated at the top of STATUS, with the phase 7 command table retained.

## Deferred work and reasons

| Deferred                                                       | Reason                                                                            |
| -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Market feeds, scheduled refresh, FX/multiple currencies        | External integration/reliability and valuation rules exceed manual USD scope      |
| Realtime collaboration, queues, Redis                          | No current single-app operation requires them                                     |
| Real estate, taxes, trade settlement, cost basis/P&L           | Different domain model; not implied by signed holdings adjustments                |
| Public registration, OAuth, recovery/onboarding                | Synthetic seeded assessment accounts are sufficient                               |
| Invitations/membership management, transfer/deletion           | Security-sensitive lifecycle outside delivered scope                              |
| Historical prices/valuation, backdated input                   | Requires separate historical semantics; new records intentionally use server time |
| AI writes, trading recommendations, arbitrary tools            | Incompatible with the read-only assistant boundary                                |
| Persistent chat and AI movement-history tool                   | Unnecessary storage/capabilities for two small read tools                         |
| Large-scale pagination/aggregation, distributed abuse controls | Future hardening; do not claim current scalability or cross-instance throttling   |
| Upload, publish, email                                         | User-operated submission tasks, never automatic actions                           |

Before recording, use VIDEO_OUTLINE's rehearsal gates. A blocked live path should be explained with actual code/tests, not substituted with an unlabeled mock.
