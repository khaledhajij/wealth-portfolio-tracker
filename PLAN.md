# Wealth Portfolio Tracker - assessment plan

Plan created: phase 0, 2026-10-24. Current implementation status: see docs/STATUS.md.
Deadline: end of Sunday, 2026-10-25, Damascus time.
Implementation phases below are proposals, each requiring a separate user instruction.

Authorized product-copy follow-up (2026-10-25): remove assessment/prototype/demo presentation from application screens, metadata, auth app name and assistant identity. Keep functional manual-price/read-only/AI-accuracy information, disabled registration and actual development/test evidence in documentation. No change to authentication capabilities, synthetic seeds or acceptance gates, and no production-readiness claim based on wording alone.

Authorized timestamp follow-up (2026-10-25): new position prices, price updates and quantity movements use server recording time at insertion/update, with no editable date or client timestamp. This supersedes the earlier observation/backdating input proposal. Keep existing priceAsOf/occurredAt DTO/schema names and historical data; no migration. Strict inputs reject timestamp overrides. An identical movement requestKey replay returns its original timestamp. Manual-price recording time is not evidence of a fresh market quote. Backdated entry remains deferred. Acceptance: bounded server-time values, rejected overrides, unchanged replay timestamps, timestamp-free form payloads and desktop/mobile error/retry behavior; actual database evidence is recorded separately in STATUS.

Vercel CA packaging follow-up (2026-10-25, user-requested deployment troubleshooting): allow only the existing public .certs/supabase-ca.crt through Git ignore rules and explicitly include it in Next.js server file traces. Keep TLS verification, private configuration/key exclusions, schema and application behavior unchanged. Prepare/document local packaging and the relative Vercel environment path; no agent push/deployment/database action is authorized by this configuration question.

Popup theme adjustment (2026-10-25, user-requested): use the dashboard's warm paper/sage surfaces, shared green/ink/border tokens, serif heading and matching form/error/focus treatment. Presentation only; existing popup and chat behavior retained.

Phase 6 popup UI follow-up (2026-10-25, user-requested): replace the inline assistant section with an accessible bottom-right popup using the pasted component as a visual reference. Keep real SDK messages/tools, current API/security, disabled configuration and portfolio-bound reset. Exclude the reference's canned messages/autoplay/replay replies because they conflict with the prototype's factual/live-feature boundary. Native dialog, close/Escape cancellation with local conversation retention, focus return/Tab wrapping, responsive/reduced-motion behavior, and controlled streaming checks. Shared visual component in components/ui; existing TypeScript/Tailwind app preserved, no scaffold/Shadcn CLI reset or stock imagery required.

Phase 6 provider change (2026-10-25, user-requested): replace the initial OpenAI adapter with direct Google Gemini Developer API through `@ai-sdk/google` 4.0.105, retaining AI SDK 7.0.153, secured read tools/streaming/limits. Server-only `GOOGLE_GENERATIVE_AI_API_KEY` and explicit Gemini `AI_MODEL`; no OpenAI fallback, provider-hosted search or execution tools. Real-provider verification still requires private configuration and an actual run. Details: [ASSISTANT](docs/ASSISTANT.md).

Phase 6 scope override (2026-10-25, latest user request): read-only streaming chat, superseding the earlier delivery-readiness phase 6 proposal. Portfolio isolation prerequisite: rerun existing service tests (38 passed before AI changes), inspect the previously user-verified real HTTP isolation evidence, and add adversarial tool-context tests. Fresh agent SQL verification remains blocked at migration preflight and must be stated separately. Only `getPortfolioSummary` and `listPositions`, empty strict model inputs, validated session/portfolio context and same secured services on every execution. POST `/api/chat` validates session/input/membership before provider use; no client history/identity/role authority. Bound request/step/output/tool/time limits, cancellation, safe errors, manual timestamps, disabled missing-key state and scoped streaming UI are required. No live-provider claim without an actual run. Current implementation/evidence: [ASSISTANT](docs/ASSISTANT.md), [STATUS](docs/STATUS.md). Delivery/remote/next-phase work remains outside this instruction.

Authorized entry-point follow-up (2026-10-25): replace the static root introduction with a server redirect to `/portfolios`; retain the existing dashboard route, layout and session protection. No dashboard duplication or next-phase work.

Phase 5.5 addition (2026-10-25, explicitly requested by the user): authenticated portfolio creation and dashboard access only. Reuse GET `/api/portfolios`, add POST with a strict name-only Zod contract (trimmed, 1-100 characters), fixed USD and session-derived identity. Insert Portfolio and its OWNER Membership in one Prisma interactive transaction; neither persists if the second insertion fails. Creation is independent of roles in other portfolios. Reuse the dashboard's native dialog/pending/error/focus behavior and Server Component list; refresh and navigate to the new empty portfolio after commit. No schema/dependency change is needed. No AI, invitations, membership editing or deletion.

Phase 5.5 acceptance: unauthenticated GET/POST denied; invalid/extra identity/role/currency fields denied; exactly one created portfolio and one session user's OWNER membership; actual PostgreSQL membership failure leaves no orphan; membership-filtered lists and existing authorization enforce isolation; a Viewer elsewhere may own a new portfolio; no-portfolios action and mobile dialog work; successful creation opens zero total/zero allocation/empty positions/history. Local tests and production negative HTTP probes are separate from real authenticated PostgreSQL/browser evidence. Current results and remaining gate: [STATUS](docs/STATUS.md). `npm run build` then `npm run test:ui` runs the expanded real-session verifier from a connected terminal. Stop after 5.5; phase 6 remains unauthorized.

Phase 5 scope override (2026-10-25): the user selected the English prototype dashboard and real API-backed forms, with Server Component reads, Client interactions, state/accessibility/mobile checks and no AI. The earlier proposed phase 5 AI row is superseded below; AI still requires a separate explicit instruction. Implementation/verification boundaries: [DASHBOARD](docs/DASHBOARD.md) and STATUS.

Phase 4 scope override (2026-10-25): the user's latest instruction selects services/contracts/Route Handlers and verification, **not dashboard UI**. Reuse phase 3 writes/auth; complete summary/position-list/manual-valuation routes and verify input, permissions, replay and real concurrent decreases. No UI or AI expansion. Actual evidence and database limitations: [API](docs/API.md) and STATUS.

Phase 3 decision (2026-10-24): the user authorized authentication and server DAL/services only, without AI/full dashboard. Better Auth/Prisma adapter 1.7.12 is selected, using existing synthetic identities with library password hashes and database sessions. Details and official references: [AUTH](docs/AUTH.md). Auth setup, minimal login/account UI, protected JSON adapters and portfolio read/add-position/movement/price services are implemented locally; live migration/session acceptance remains blocked, as recorded in STATUS. Registration, account recovery and membership management stay deferred. Earlier proposal text remains a record of the plan, not a claim that all acceptance gates passed.

## 1. Sources and requirement boundaries

Primary source: Talent Syria technical assessment (original filename: `Talent Syria - Technical assessment.pdf`). All three pages were read as text and visually inspected during phase 0. The original PDF is not present in the current phase 3 workspace; the requirement record below is retained from phase 0.
Second source: the user's foundational scope and phase 0 instructions in this conversation.

| Source | Explicit requirement or statement | Consequence |
| --- | --- | --- |
| PDF p. 1 | Build a prototype; select a subset of the capabilities intentionally. Understanding and architectural reasoning matter. | Explain every implemented decision; completeness of all listed features is not required. |
| PDF p. 1 | Multi-asset records, history, roles, embedded AI, async data, realtime, and UI craftsmanship are candidate capabilities. | These are selection options, not a mandate to implement all of them. Real estate and AI writes are examples, not compulsory features. |
| PDF pp. 1-2 | Reference stack is optional, including the choice of a unified or separate backend. | Our stack is selected by the user, not mandated by the assessment. |
| PDF p. 2 | Written plan is the minimum deliverable; a plan alone is acceptable. Source repository should have clear README setup instructions, as far as completed. | This phase supplies a plan; runnable source and setup instructions remain future work. |
| PDF pp. 2-3 | A 10-15 minute screen recording with voice should cover scope, AI tools/execution/streaming, permissions, stack trade-offs, and AI-assisted development. Share a video link. | Prepare an explainable implementation and factual development record; no video exists yet. |
| PDF p. 1 | Submission is an email reply with repository and video links by the stated deadline. | This describes eventual submission. It does not authorize this agent to create a remote, upload, or send email. |
| PDF p. 3 | Evaluate prioritization, pragmatic architecture, agent integration, security/modeling, and AI orchestration. | Security boundaries and honest feature status are acceptance gates. |
| User scope | Next.js App Router, React, TypeScript, PostgreSQL, Prisma, Zod, Tailwind, Vercel AI SDK; one application. | Use one Next.js application and database, without a separate Express service. |
| User scope | Stock, crypto, cash; USD only; timestamped manual prices; cash price = 1. | No market integration or currency conversion. |
| User scope | User/Session, Portfolio, Membership (Owner/Editor/Viewer), Position, append-only PositionMovement. | Derive quantity from movements and value from quantity times manual price. This is not trade accounting or purchase execution. |
| User scope | Trusted session identity, server authorization, portfolio isolation, shared API/AI services; AI cannot perform financial mutations. | No client-supplied identity/role and no AI write tools. |
| User scope | No remote repository, deployment, email, real personal data, or automatic scope expansion. | Local work with synthetic fixtures only; stop after each requested phase. |

Everything labeled "proposed" below is a design decision for this prototype, not a quotation from the PDF or evidence of implementation.

## 2. User journey (proposed)

1. Sign in with a synthetic demo account using a real server-validated session. Clearly label accounts and holdings as demo data. No identity-switching header or client role toggle.
2. See only portfolios for which the current user has a Membership. Empty state explains how an authorized user can create a portfolio.
3. Create a portfolio and its Owner membership atomically, or open an accessible portfolio. Display its role, total USD valuation, asset allocation, positions, and price timestamps.
4. Owner or Editor adds a stock/crypto/cash position, records a signed quantity movement, and sets a manual stock/crypto price with its observation time. Cash uses a fixed unit price of USD 1.
5. Review the resulting quantity, position value, and append-only movement history. Corrections are new movements, never edits of history. Refresh reads after writes; no collaboration or realtime synchronization is promised.
6. Viewer sees the same authorized portfolio reads but no financial edit controls. The server denies forged write requests regardless of UI visibility.
7. Ask the embedded assistant for this portfolio's summary, allocation, or history. Authorized read tools supply facts; streamed output identifies manual price times and limitations. A request to change holdings is refused without a mutation.
8. Sign out; the server invalidates the session and protected pages/API/tools no longer return data.

Proposed screens: sign-in, portfolio list/create, portfolio detail with positions and movement history, and a read-only assistant panel. Include empty/loading/error states, accessible form labels, keyboard use, validation messages, and pending submission states. No onboarding or membership management screen.

## 3. Single-application architecture (proposed)

Flow: browser -> Next.js server entry point -> trusted session -> portfolio-scoped service -> Prisma -> PostgreSQL.
AI flow: browser chat -> authenticated chat route -> Vercel AI SDK/model -> allowlisted read tool -> the same portfolio-scoped service -> authorized data -> streamed response.

- App Router pages and route handlers live in one application; React/Tailwind provide the UI. No separate API process, worker, Redis, or realtime server.
- Modules: `app/` for pages/routes, `prisma/` for schema/migrations/synthetic seed, and `lib/server/` for the internal database/valuation code added in phase 2. Auth, Zod request contracts, write services and AI adapters remain planned; do not expose a database function before trusted session integration.
- Every service receiving a portfolio ID verifies current membership using server-derived identity. Position lookups constrain both position ID and portfolio ID. Server components must use the same service boundary as API and AI tools.
- Transport adapters validate request shape; service methods also enforce domain rules and authorization so a different entry point cannot bypass them. Zod validates runtime inputs; TypeScript alone cannot validate an HTTP request or model tool arguments.
- Server-only modules hold database access and provider credentials. Return explicit DTOs with decimal strings; never expose session hashes, password hashes, secrets, or unrelated members' data to the browser/model.
- Prisma is chosen for explicit relational models and migrations; database constraints supplement service rules. Tailwind avoids an additional mandatory component framework. The AI SDK is chosen for typed tool integration and streaming inside the existing application, with APIs verified for the selected version.
- Phase 1 installs the framework/tooling dependencies; exact versions and verification are recorded in README/STATUS with one lockfile (no Git commit was requested). For later integrations, select mutually compatible versions, consult their official version-matching documentation, pin direct versions, update that lockfile, and record runtime/package-manager versions. Verify with a clean locked install, typecheck, lint, and production build. Do not copy unverified SDK/Prisma/Next.js APIs into implementation.
- Model provider, exact model, session library versus a minimal implementation, and exact package versions remain unresolved until the relevant phase. Prefer a maintained session solution compatible with the chosen stack; document the trade-off. No live AI capability is claimed before a provider-backed call succeeds.

## 4. Entities and invariants (proposed fields)

IDs are opaque; opacity is not authorization. Timestamps are stored in UTC and displayed with an explicit timezone. USD is the only supported currency.

| Entity | Proposed fields and relationships | Invariant |
| --- | --- | --- |
| User | id, unique synthetic email, name, createdAt | Phase 2 domain records only; no password or credential fields. Reconcile with the auth library in phase 3. |
| Session / auth tables | Deferred until authentication library selection in phase 3 | No temporary session system. Trusted server identity and revocable session behavior remain required. |
| Portfolio | id, name, currency=USD, createdAt | Created in a transaction with an Owner membership. Ownership is represented by Membership, avoiding two sources of role truth. |
| Membership | id, userId -> User, portfolioId -> Portfolio, role, createdAt | Unique (userId, portfolioId); role enum OWNER/EDITOR/VIEWER. Multiple owners permitted by model, but transfer/role editing is deferred. |
| Position | id, portfolioId -> Portfolio, assetType, symbol/label, unitPrice, priceAsOf, createdAt, updatedAt | Type STOCK/CRYPTO/CASH; required nonnegative manual USD price and timestamp; cash price is always 1. No quantity column. Future price-write audit fields can be added with that service. |
| PositionMovement | id, portfolioId, positionId, signedQuantity, requestKey, note, createdBy -> User, occurredAt, createdAt | Nonzero signed decimal; immutable after insertion. Composite position/portfolio FK. Globally unique requestKey per operation. Actor must come from the session when writes are exposed in phase 3. |

Additional proposed rules:

- One position per normalized stock/crypto symbol and asset type per portfolio, and one USD cash position. A symbol is a user label, not a verified exchange identifier. Do not merge positions across portfolios.
- No short positions: resulting quantity must remain >= 0. Use PostgreSQL serializable transactions with bounded conflict retries (or an equivalently documented per-position locking approach) for movement validation and insertion; two concurrent withdrawals must not both spend the same quantity.
- Use database decimal arithmetic, proposed `Decimal(28,10)` for quantities and `Decimal(28,8)` for unit prices. Validate precision/range; reject excess precision instead of silently rounding it. Cash deltas use at most two decimal places.
- Compute with decimal arithmetic through the service layer, returning decimal strings. Round only displayed USD totals to cents using a documented half-up rule; compute allocation from unrounded values. Bound values/aggregates before writes so database numeric overflow returns a controlled validation error.
- No update/delete movement endpoint or tool. Application services expose append/read only; database protection against movement UPDATE/DELETE should be included in the migration, with a distinct migration owner if needed. Verify protection using the runtime database role. Portfolio/position deletion is deferred to preserve history.
- Planned price updates replace the current manual price and record observation/update times and actor (actor audit field and write service are deferred to phase 3). Historical prices and historical valuation are deferred; movement history alone cannot reconstruct historical portfolio values.
- New writes now use server recording time, superseding the initial user-provided observation-time proposal. Client timestamp fields are rejected; the UI shows UTC manual-price timestamps without editable dates. Historical timestamps remain unchanged. No stale threshold is required; clearly label values as based on manual prices. Cash's USD 1 is a fixed rule, not a market observation; show it as fixed and retain the server timestamp of its creation/confirmation.

## 5. Permission matrix (proposed policy)

All roles in this matrix are resolved from current database membership, never accepted from a request body, query parameter, header, or tool argument.

| Operation | Owner | Editor | Viewer | Signed in nonmember | Anonymous |
| --- | --- | --- | --- | --- | --- |
| Create a new portfolio with self as Owner | Yes | Yes | Yes | Yes | No |
| List portfolios | Own memberships only | Own memberships only | Own memberships only | Own memberships only | No |
| Read selected portfolio, positions, movements, valuation | Yes | Yes | Yes | No | No |
| Use assistant read tools for selected portfolio | Yes | Yes | Yes | No | No |
| Rename portfolio | Yes | No | No | No | No |
| Add position, append movement, update manual price | Yes | Yes | No | No | No |
| Edit/delete existing movement | No | No | No | No | No |
| AI financial write, including at Owner request | No | No | No | No | No |
| Manage memberships, transfer ownership, delete portfolio | Deferred | Deferred | Deferred | No | No |

"Owner/Editor/Viewer" applies to an existing selected portfolio; portfolio creation is available to any authenticated user, regardless of roles elsewhere. Synthetic seeds provision role combinations; no public role assignment endpoint.

Security acceptance policy: missing/expired session -> 401; accessible portfolio with inadequate write role -> 403; unknown or inaccessible portfolio/position -> 404 without revealing its existence. Protected page redirects may differ from JSON responses but must disclose no protected data. Private data must not enter a cross-user cache. Check membership on each service invocation, including each AI tool call, so an old chat cannot preserve revoked access.

Mutating browser routes must enforce same-origin/CSRF protection as appropriate for the chosen session approach. Cookies must be HttpOnly, SameSite, and Secure under HTTPS; document local HTTP development handling. Validate errors without leaking stack traces or secrets. Return minimum required portfolio data to the provider, and use synthetic data in all demonstrations.

## 6. Manual quantities and valuation

For position p:

`quantity(p) = sum(PositionMovement.signedQuantity for p)`

`valueUsd(p) = quantity(p) * Position.unitPrice(p)`

`portfolioValueUsd = sum(valueUsd(p) for authorized positions in that portfolio)`

`allocationPercent(p) = valueUsd(p) / portfolioValueUsd * 100` when total > 0; otherwise display 0% and an empty allocation state.

An initial balance is the first positive movement. A reduction is a negative movement; a correction is an additional signed movement with an explanation. These are records of externally held assets, not buy/sell orders, cash settlement, realized gains, cost basis, or profit/loss. Increasing a stock quantity does not automatically decrease cash. A zero manual stock/crypto price is allowed as an explicit user input and must not be confused with an unknown price; missing prices are invalid.

Illustrative synthetic example, not market data:

| Position | Movement deltas | Derived quantity | Manual USD unit price | Value USD |
| --- | --- | --- | --- | --- |
| DEMO stock | +10, -2 | 8 | 25 | 200 |
| DEMO crypto | +0.01, +0.01 | 0.02 | 30,000 | 600 |
| USD cash | +150, -50 | 100 | 1 fixed | 100 |
| Total | | | | 900 |

Assume stock/crypto price observation time is 2026-10-24 12:00 UTC. If the stock price is manually changed to USD 30 later, quantity stays 8, stock value becomes 240, and total becomes 940. Movement records remain unchanged. This is a current manual snapshot, not a live quote or an investment recommendation.

Phase 2 uses a smaller seed/test example: stock +12 -2 = 10 at USD 50, plus USD 100 cash, totals 600. Changing only price to 60 totals 700. A separate seeded portfolio contains 0.25 crypto at 800, totaling 200. See docs/DATABASE.md; database execution remains unverified until the documented steps run.

## 7. Read-only AI design and acceptance

Phase 6 selected tools: `getPortfolioSummary` (total, allocation, manual-price time range) and `listPositions` (at most 10 positions with exact server values/times). Both use strict empty input contracts and server-bound actor/portfolio context. Movement-history AI access is deferred to keep results and capabilities small; the manual dashboard history remains available. Never accept role, userId, arbitrary SQL, or a portfolio override from the model.

The chat route validates the session and selected portfolio before provider use; every tool invokes the same authorized read service again. Do not offer generic HTTP, database, execution, or write tools. Portfolio names, notes, and prompts are untrusted data; instructions embedded in them cannot grant access. Bound message size/history, tool steps, result sizes, and provider duration using APIs supported by the installed SDK. No persistent chat storage is needed for this prototype.

Services calculate all totals; the model explains returned facts and cites price timestamps. No rebalancing advice or fabricated market facts are needed. Owner financial mutations remain unavailable through AI, including indirect or prompt-injected requests. Return a clear refusal for write requests and direct users to authorized manual forms.

Stream real provider responses when configured. Missing credentials, provider error, timeout, or unavailable provider produces a clear unavailable/error state; do not render canned replies as live AI. Deterministic test doubles must be labeled as tests and cannot count as live integration verification. Record the exact SDK/model integration verified, and whether synthetic portfolio data was sent to the provider.

## 8. Proposed implementation order and verifiable acceptance gates

Every row below is PLANNED unless STATUS explicitly records observed evidence. Implementation requires the next phase request, not this plan's existence.

| Phase / component | Proposed work | Verifiable acceptance criteria |
| --- | --- | --- |
| 0 - discovery and documentation | Inspect repository/PDF; write PLAN, STATUS, AI_USAGE. | All 3 PDF pages reviewed; source vs user constraints vs proposals separated; no application source added; documentation paths resolve; Git changes reviewed. |
| 1 - application foundation | Single Next.js App Router/TS/Tailwind scaffold; pinned versions/lockfile; `.env.example`, `.gitignore`, README; clearly labeled static prototype page. The user's phase 1 instruction explicitly defers database, authentication and chat implementation. | Official docs checked for selected versions; clean locked install, typecheck, lint, production build; initial page serves without database/AI credentials; no fabricated database data; secrets ignored; one app and one lockfile. Record actual results. |
| 2 - database foundation | PostgreSQL/Prisma config, schema/migrations and repeatable synthetic seed; internal server Decimal valuation and tests. Per the newer user instruction, no auth library tables, temporary sessions or public endpoints. | Schema validation/client generation pass; unit checks cover 600 -> 700, fractions and empty total. Apply migrations/seed and verify constraints/isolation if a local database is available; otherwise report SQL/seed/DB checks unverified and provide setup. |
| 3 - authentication, services and isolation | Select auth library and reconcile domain User with adapter tables; trusted sessions; Zod contracts; portfolio/position/movement/price services and authorized adapters. | Session expiry/logout/forgery and full role matrix tested; mismatched IDs disclose nothing; runtime DB role cannot alter history; atomic writes and concurrent negative-balance prevention; retries verify requestKey payload; validate scale/range/cash cents/timestamps before database rounding. |
| 3 - numeric rules | Decimal math, prices/times, precision limits, zero state. | Synthetic example returns 900, then 940 after price update; fractional quantities exact; empty portfolio total 0; allocation with total 0 defined; client-supplied timestamp overrides, negative prices, zero deltas, excessive precision/range, and negative resulting balances rejected. A failed write leaves no partial state. |
| 4 - portfolio services and HTTP API (latest user scope) | Summary, listing/creating positions, append-only movements, timestamped manual price updates; session/membership/resource checks and strict contracts. Dashboard/forms remain deferred. | Role/access/input/replay checks; minimal DTOs and consistent safe errors; 600 -> 700 without implicit cash adjustment; real simultaneous decreases from 10 by 8 each accept only one and leave 2. Implement serializable transaction/row locks/retries and record actual DB test results; do not infer a concurrency pass from mocks. |
| 5 - dashboard and real forms (latest user scope) | English calm portfolio list/detail, allocation by asset type, positions/history, API-backed position/movement/manual-price forms; Server reads and Client interactions. No AI. | Real sign-in/list/detail/create/movement/price/refresh/logout journey; invalid/pending/error/empty/success/focus behavior; Viewer UI and server denial; mobile usability. Record live versus component-only test evidence separately; no fake data fallback. |
| 5.5 - portfolio creation (explicit addition) | Session-bound POST and existing filtered GET; atomic portfolio/Owner membership; creation dialog and empty-state dashboard access. | Strict trimmed 1-100 character name and fixed USD; reject identity injection; real rollback/no orphan; isolated lists/resources; Viewer can own a different portfolio; UI pending/error/focus/mobile checks and zero empty dashboard. Separate local evidence from pending SQL/browser gates. |
| 6 - read-only streaming AI (latest user scope) | Installed-version AI SDK, two server-bound read tools, protected chat route, limited streaming UI and missing-key disablement. | Isolation checked before integration; no model identity/scope authority; each tool rechecks secured services; strict small DTOs/manual timestamps; bounded steps/output/input/time; errors/stop/switch isolation tested; actual live versus mock/blocked evidence separated. See ASSISTANT/STATUS. |

Use focused automated tests for domain arithmetic, access control, database invariants/concurrency, and AI service isolation. Use browser checks for the user journey and states. Do not mark tests as passed because they are planned or because a test file exists. Prefer completing secure vertical slices over extra features if time is short. Stop at each requested phase and report remaining gaps honestly.

## 9. Deferred features and reasons

| Deferred item | Reason |
| --- | --- |
| Market feeds and scheduled price updates | Adds external credentials, reliability, licensing, and stale-feed behavior; manual timestamped prices are sufficient. |
| Queues/workers/Redis and background valuation sync | On-demand sums are sufficient for the small prototype; keep one application. |
| Realtime collaboration, presence, shared notes | Adds synchronization/conflict scope; refresh after a write is sufficient. AI response streaming is separate from collaboration. |
| Real estate | Requires property-specific valuation and modeling; stock/crypto/cash already demonstrate multiple asset types. |
| FX and multiple currencies | Avoid conversion rates and mixed-currency totals; USD only. |
| Taxes, cost basis, realized P/L, trade execution and settlement | Movement-based holdings and valuation are not an accounting or brokerage system. |
| Onboarding, registration, recovery, invitations, full membership administration and ownership transfer | Synthetic seeded accounts/memberships demonstrate authorization without account lifecycle scope. |
| AI writes, autonomous trading, investment advice/rebalancing recommendations | Read-only tools demonstrate agent boundaries while keeping financial changes explicit in manual forms. |
| Historical prices/charts/valuations and persistent chats | Current manual snapshot and append-only quantity history meet this chosen scope; extra historical models are unnecessary. |
| Position/portfolio deletion, shorting, transfers and automatic cash balancing | Avoid destroying audit history or implying trade accounting; explicit signed movements cover balance changes. |
| Remote repository, deployment, video upload and email submission | Require separate explicit authorization; delivery preparation is local only. |

## 10. Walkthrough outline (target 12 minutes)

- 0-2 min: assessment scope, deliberate omissions, synthetic-data disclaimer.
- 2-4 min: user journey, manual prices and the 900 USD example.
- 4-7 min: entities, session -> service -> database, roles and a rejected cross-portfolio request.
- 7-10 min: assistant -> read tool -> same service, real streaming if verified, write refusal and provider limitations.
- 10-12 min: chosen stack/versions, trade-offs, actual verification and unverified gaps, factual AI assistance record.

Explain only what exists at recording time. No claim of human authorship, production security, passing tests, deployment, or live AI without evidence. Use [STATUS](docs/STATUS.md) and [AI usage](docs/AI_USAGE.md) as the evidence ledger.
