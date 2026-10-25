# Phase 4 portfolio API

Phase 6 adds POST `/api/chat`: strict `{ portfolioId, message }`, trusted session and selected membership checked before provider construction. Same-origin JSON, actual 8 KiB body cap, private/no-store and safe errors retained. The successful response is an AI SDK UI SSE stream, not JSON; pre-stream failures use the existing JSON error contract (401 session, 404 nonmember, 400 invalid fields, 403 Origin, 503 missing AI configuration). Tools have no model-supplied scope/identity arguments and recheck the same services on each execution. Contracts, cancellation/time/token/read limits and test boundaries: [ASSISTANT](ASSISTANT.md). Existing portfolio endpoints remain unchanged.

Implemented in the existing single Next.js 16.4.3 application, using Prisma 7.10.1/PostgreSQL and Zod 4.6.7. No UI, AI, dependency or schema/migration changes in this phase. Existing phase 3 services/routes are reused.

## Routes and DTOs

Phase 5.5 adds authenticated POST `/api/portfolios` with `{ "name": "My portfolio" }`. The strict contract trims the name (1-100 characters) and rejects extra fields, including userId/ownerId/role/currency. The service derives the actor from the session and inserts Portfolio (USD) plus OWNER Membership in one interactive transaction; failure rolls back both. No preexisting membership is required. Returns 201 `{ id, name, currency: "USD", role: "OWNER" }`, with existing Origin/JSON/body-limit/error/no-store protections. Creation has no automatic retry/idempotency key: after an ambiguous network result, check the list before trying again. Names need not be unique.

Existing GET `/api/portfolios` returns only that session user's membership-filtered `{ id, name, currency, role }` rows (200); no membership details or other users' portfolios. Both operations require a valid session. A Viewer in another portfolio can create and own a new one. No invitations, role-management or delete endpoint is added. Real creation/rollback/isolation test execution is pending; see phase 5.5 evidence in STATUS.

Phase 5 adds allocationByAssetType to the shared valuation/summary result (assetType, exact value and percentage, including explicit zero groups). The dashboard also calls a new server-only portfolio-history reader with the same membership policy; no additional public history route or mutation was introduced. Phase 4 acceptance below describes the earlier user-verified API run; phase 5 UI evidence is separate in DASHBOARD.md.

| Method and path | Result | Success status |
| --- | --- | --- |
| GET `/api/portfolios/:portfolioId/summary` | `{ portfolioId, currency, totalValue, displayTotal, positions }`; each valuation position has id, movement-derived quantity, unitPrice, priceAsOf, value and allocationPercent | 200 |
| GET `/api/portfolios/:portfolioId/positions` | Array of `{ id, portfolioId, assetType, label, symbol, unitPrice, priceAsOf, quantity, value }` | 200 |
| POST same positions path | Create a zero-quantity position; returns position metadata without an implicit movement | 201 |
| POST `/api/portfolios/:portfolioId/positions/:positionId/movements` | Append a signed quantity movement; return `{ id, signedQuantity, occurredAt, note }` | 200, including identical retry |
| PATCH `/api/portfolios/:portfolioId/positions/:positionId/valuation` | Update manual price/time with session-derived priceUpdatedBy; return position metadata | 200 |

Existing GET portfolio/individual-position/history routes remain. Existing PATCH on the individual position is a compatible alias of the valuation operation; both use the same updatePrice service. History GET remains bounded to the latest 100 rows; pagination is deferred. No movement update/delete method exists.

Money, quantities, values and percentages are decimal **strings**. Timestamps are ISO strings; stock/crypto prices are manual observations, not market feeds. Summary uses exact unrounded Decimal values; displayTotal rounds the final sum to cents, half-up. Empty summary returns 0 / 0.00 and an empty positions array. Quantity increases do not reduce cash or execute a purchase.

Example request bodies (synthetic values):

```json
{
  "assetType": "STOCK",
  "label": "Synthetic stock",
  "symbol": "DEMO",
  "unitPrice": "50",
  "priceAsOf": "2026-10-24T10:00:00.000Z"
}
```

```json
{
  "signedQuantity": "2",
  "occurredAt": "2026-10-24T10:00:00.000Z",
  "requestKey": "a-new-client-generated-operation-key",
  "note": "External holding adjustment, not a purchase"
}
```

```json
{
  "unitPrice": "60",
  "priceAsOf": "2026-10-25T00:00:00.000Z"
}
```

## Authorization, validation and errors

Production composition in lib/server/portfolios.ts binds the services to requireUser. Every service invocation derives identity from Better Auth's verified session; no method accepts client userId/role. Reads require an explicit Owner/Editor/Viewer Membership for the selected portfolio. Writes require Owner/Editor. Resource access constrains positionId **and** portfolioId; membership in another portfolio does not grant access. Unknown roles are denied. The new summary/list share the same membership-scoped nested read; no private result cache is introduced.

Write bodies are strict Zod objects: extra identity/role/actor fields are rejected. Header/query identity claims are unused. Unit prices accept at most 20 integer/8 fractional digits; signed quantities at most 18 integer/10 fractional digits, nonzero. Numbers/exponents/NaN/infinity, negative prices, future timestamps and submillisecond timestamp precision are rejected before database coercion. Symbols are trimmed/uppercased and rechecked for length after case conversion. IDs containing whitespace are invalid. Cash requires symbol USD, unit price 1 and movement precision of cents. The resulting nonnegative quantity must remain below 10^18.

Financial HTTP mutation requests require a verified matching Origin and application/json, with an 8 KiB actual streamed-body bound. These transport checks precede service execution; malformed JSON can return 400 before session evaluation. Valid anonymous requests return 401. Services themselves still authenticate and validate, so another server caller cannot bypass these rules by skipping a Route Handler.

Portfolio API errors have the additive, stable shape `{ code, error }`, retaining the existing error string:

| Status | Code | Meaning |
| --- | --- | --- |
| 400 | INVALID_REQUEST | Invalid input, cash rule or insufficient resulting balance |
| 401 | UNAUTHENTICATED | No valid session |
| 403 | FORBIDDEN | Member lacks write access, or invalid HTTP origin |
| 404 | NOT_FOUND | Unknown/inaccessible portfolio or resource; existence is not disclosed |
| 409 | CONFLICT | Duplicate position, conflicting operation key or exhausted concurrency retries |
| 503 | UNAVAILABLE | Unexpected failure; raw adapter errors and secrets are suppressed |

All handled portfolio API responses use `Cache-Control: private, no-store` and `Vary: Cookie`. Unsupported methods use Next.js's framework 405 behavior. Library auth endpoints retain the library's response contracts.

## Implemented concurrency and idempotency mechanism

Movement writes execute these steps in a **single PostgreSQL serializable interactive transaction**:

1. Lock the selected user's Membership with FOR SHARE and verify the current write role. Future membership updates must wait until this transaction finishes.
2. Lock the target Position with SELECT ... FOR UPDATE, constraining both its ID and portfolio ID. Missing/foreign resources return 404.
3. Validate the input, then look up the globally unique requestKey. If found, compare portfolio/position/creator/quantity/time/note. An identical retry returns the existing DTO; conflicting contents return 409 without exposing another movement.
4. Read SUM(signedQuantity) for this position and add the proposed signed delta using Decimal. Reject negative/out-of-range resulting quantities and invalid cash precision.
5. INSERT the new movement and commit. No history update/delete and no automatic cash write.

The existing position lock serializes competing writes to that position. **A lock alone does not refresh a serializable transaction's earlier snapshot.** PostgreSQL's serializable isolation additionally detects conflicting read/write dependencies, including movement inserts after an aggregate read. On Prisma P2034 or raw-query P2010 with SQLSTATE 40001/40P01, retry the entire transaction with a fresh snapshot, at most three attempts. Exhaustion returns 409. Movement P2002 unique-key races also retry in a new transaction so the committed key can be compared; duplicate position creation returns 409 immediately. Unique constraints remain the final duplicate-insert guard. No success is returned before commit completes.

Price updates use the same transaction/membership/position lock path and record priceUpdatedBy from the session. Current-price updates do not edit quantities or movement rows. These rules protect application service writes; a privileged database owner directly bypassing services is outside this boundary. Existing append-only triggers/DB privilege limitations remain documented in DATABASE.md.

## Verification and remaining limits

Official references checked against the installed stack:

- [Prisma 7 transactions/retries](https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions)
- [PostgreSQL 17 transaction isolation](https://www.postgresql.org/docs/17/transaction-iso.html)
- [Next.js 16 Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route)
- [Zod 4.6 schemas](https://zod.dev/api)

Local evidence: npm test passes 32 tests, with explicit DB/session doubles for service unit checks; typecheck, lint and production build pass. Local production HTTP checks without a database session verify 7 unauthenticated/forged identity requests return 401, malformed JSON 400 and invalid Origin 403, with stable error codes/private no-store. These checks do not prove successful authenticated writes or PostgreSQL concurrency.

Latest user-terminal evidence: the user supplied the updated test:api PASS lines for real HTTP access/input/origin, valuations/fractions/replay/actors, concurrent decreases and simultaneous identical-key submissions. The concurrent-decreases report shows two blocked queries, successful observation/guard, HTTP 200 plus 400/INVALID_REQUEST, final quantity 2 and two movement rows. All functional assertions passed in that supplied run; no process exit code or cleanup transcript was supplied. The agent's separate db:inspect/test:api connection still fails at read-only preflight, and is not presented as a successful agent-run DB test. Phase 4 functional acceptance is complete based on the combined evidence.

From the terminal with working PostgreSQL connectivity:

```powershell
npm run db:inspect
npm run db:status
# If pending migrations exist, inspect history before applying the existing SQL.
# Do not reset, recreate valid migrations, or use db push.
npm run build
npm run test:api
```

Apply pending migrations and seed demo credentials only if required by the inspected state, following README/AUTH. No new migration or credentials are needed specifically for phase 4. `test:api` expects all local migration checksums to match and the existing seeded demo users/password to work. It starts and stops its **own** production Next.js child on an available loopback port, using private environment values and a process-local origin override; it does not use or stop a developer's existing server.

The verifier logs in with the real library over HTTP and creates two new labeled synthetic verification portfolios per run. Existing demo memberships/holdings are untouched. All financial probes use the real HTTP routes. It checks empty/600/700/fractional valuations, unchanged cash, allowed/denied operations, strict input, duplicate operations and actor attribution.

For the overdraft check, it opens a separate guard transaction locking a new test position with quantity 10, records that transaction's pg_backend_pid, dispatches two HTTP decreases of 8, and uses recursive pg_blocking_pids links plus pg_stat_activity to observe **both** blocked Position queries, including queued blockers. It releases the guard only after observation (or on failure). Required result: one 200, one 400, exactly one withdrawal row and resulting quantity 2. It also dispatches simultaneous identical request keys and requires the same DTO and one inserted movement. The role must be able to inspect its own activity/blocker graph. application_name matching is now diagnostic only, since forwarding through the pooler is not assumed. If overlap cannot be observed, the test fails instead of reporting concurrency as passed. See [PostgreSQL 17 blocker functions](https://www.postgresql.org/docs/17/functions-info.html).

Historical follow-up: the first user run supplied the two initial PASS lines, then an assertion at the old generic concurrent-decrease stage. The verifier was updated to print safe counts/statuses/final synthetic balance and to observe the actual blocker graph. The later user run passed all functional assertions, with maxBlockedQueries=2 and maxTaggedQueries=0. Thus tag forwarding was insufficient to observe those blocked requests on the successful run; the exact original failed assertion remains uncaptured. No credentials, SQL text or connection metadata is printed, and production protection/pass criteria were not weakened.

Verification portfolios/movements remain as synthetic audit records, including partial fixtures on a later failure; append-only history is never deleted for cleanup. A fresh run uses new IDs/keys. Only sessions created by the verifier are signed out. No destructive database action, managed-schema change, UI expansion, AI or deployment is performed. Runtime DB privilege/Data API hardening and the previously identified auth rememberMe duration discrepancy remain outside this phase's code changes.
