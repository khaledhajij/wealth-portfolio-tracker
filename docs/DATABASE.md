# Phase 2 database setup and model

## Execution status

Current evidence (2026-10-24): the user supplied a successful authenticated inspector result for PostgreSQL 17.11 through Session pooler 5432, with no public tables and no Prisma migration history. The agent's restricted attempt returned EACCES and its elevated retry timed out. Existing migrations were reviewed and preserved; no migration or seed ran in this follow-up. Execute the sequence below in the working user terminal and report results. Migration application, repeatable seed, SQL constraints and database-backed valuation remain unverified; phase 2 is incomplete.

### Earlier troubleshooting history

Latest user report: after switching off their VPN, the inspector reached TLS but returned SELF_SIGNED_CERT_IN_CHAIN. The agent's separate retry still timed out; neither result proves a successful database session. Support for an official CA file is now implemented and local checks pass, but the CA has not been supplied and CA-backed database connectivity is untested. Phase 2 remains incomplete.

Initial phase 2 prepared the schema/migrations/seed without a configured database. In the continuation, the user supplied a private Supabase DATABASE_URL in `.env.local`. The existing Prisma 7 config and scripts load it; Next build also reports loading `.env.local`. Direct connection failed DNS; the user's replacement Session pooler resolves to IPv4 and accepts TCP on port 5432, but PostgreSQL sessions time out or return ECONNRESET. Prisma migrate status also failed with a schema engine error. **Migration state, application of migrations, seed repeatability and database constraints remain unverified. Phase 2 is not complete.** No migration/seed was attempted while the existing database state could not be inspected, and no schemas/data were reset or deleted.

The user reports Healthy project status and provided a `pg_pgrst_no_exposed_schemas` error. Supabase documents that log as an artifact of disabling the Data API, which should not adversely affect the project ([official troubleshooting](https://supabase.com/kb/troubleshooting/schema-pg_pgrst_no_exposed_schemas-does-not-exist)). No schema workaround was applied. That log does not establish the cause of the Prisma/pg connection reset. The user subsequently ran the read-only inspector locally and reported the same Session pooler timeout/termination, reproducing the failure outside the agent environment. Next inspect Supavisor/Pooler logs at the attempt time; root cause remains unconfirmed.

## Supabase connection and safe migration sequence

### Official CA for certificate-chain errors

Download your project's CA certificate from Supabase Database Settings > SSL Configuration ([official SSL guide](https://supabase.com/docs/guides/platform/ssl-enforcement)). Save the PEM certificate as `.certs/supabase-ca.crt` in this repository; the local directory exists and is ignored by Git. Add this nonsecret path to the existing private `.env.local` file:

```dotenv
DATABASE_SSL_CA_FILE=.certs/supabase-ca.crt
```

Then run `npm run db:inspect`. No password/URL change is needed for this CA setting. The shared Node-only `lib/server/postgres-config.ts` validates that the supplied PEM is a CA certificate, configures pg with that CA and rejectUnauthorized=true, and avoids URL SSL parameters overwriting that object. Prisma's migration engine receives the same certificate via sslcert with sslmode=require and sslaccept=strict. No TLS verification is disabled. The actual certificate and successful database trust remain unverified until the downloaded file is provided.

Do not fix SELF_SIGNED_CERT_IN_CHAIN using NODE_TLS_REJECT_UNAUTHORIZED=0, no-verify modes, or rejectUnauthorized=false. Obtain the expected CA from the authenticated project dashboard rather than trusting an arbitrary certificate observed on the failing connection. Hostname/certificate errors after configuring the official CA require further diagnosis, not bypassing verification.

Keep DATABASE_URL in the ignored local env file; no Supabase API key is needed for Prisma. Use the full Connect-panel Session pooler URL (port 5432) on IPv4-only networks, or a reachable Direct URL. URL-encode password characters. `npm run db:inspect` reads only server/table/migration metadata, suppresses connection details and compares applied migration checksums with local SQL if a session succeeds. It never applies SQL migrations. The server-side pg adapter and inspector default to TLS `verify-full` for Supabase when sslmode is absent; certificate verification is not disabled.

If TCP works but the PostgreSQL session times out, confirm project Active/Healthy status, the exact Session pooler username/password copied from Connect, and any Supabase Network Restrictions. Test the same URL from a trusted local terminal without pasting secrets into chat. Do not reset the database or expose/disable security settings to diagnose it. Current errors do not establish that the password is wrong or that migrations are missing.

After connection is restored:

```powershell
npm run db:inspect
npm run db:status
# Review existing public tables, migration names and checksum agreement first.
npm run db:migrate
npm run db:status
npm run db:seed
npm run db:seed
npm run test:db
```

If existing tables conflict, or applied migration history/checksums disagree, stop and inspect before writing. Do not recreate the valid initial SQL, run db push, baseline blindly, or reset. The application database must never be used as a shadow database. These checked-in migrations use `migrate deploy`, which requires no shadow database. For future migration development, create a **separate disposable development/shadow PostgreSQL database** and configure a private `shadowDatabaseUrl` for that workflow only; no shadow database is configured or needed here. Never modify Supabase-managed schemas such as auth/storage.

For a Prisma-only Supabase project, review the Data API exposure setting described in the [official Supabase Prisma guide](https://supabase.com/docs/guides/database/prisma); table exposure/RLS and runtime privileges must be resolved before public access. No dashboard setting or managed schema was changed by the agent.

## Local PostgreSQL setup

Install/start a maintained PostgreSQL 17.x server with the `psql` client on Windows, or use an existing local development installation. No exact PostgreSQL patch is claimed installed/tested. In `psql -U postgres`, create a dedicated development role/database:

```sql
CREATE ROLE wealth_dev LOGIN;
\password wealth_dev
CREATE DATABASE wealth_portfolio OWNER wealth_dev;
\q
```

`\password` prompts for a local password instead of putting it in a command/history/file. These commands assume a local administrative connection and a fresh role/database. Do not reset/delete an existing database to follow this guide.

Copy `.env.example` to `.env.local` only if it does not exist, then set DATABASE_URL locally to the shape `postgresql://wealth_dev:<URL_ENCODED_LOCAL_PASSWORD>@127.0.0.1:5432/wealth_portfolio`. Replace the placeholder privately. Leave AI keys empty. Prisma config and CLI scripts load `.env.local` using `@next/env`; process environment overrides file values. No local credential file was created by the agent.

From the repository root:

```powershell
npm ci
npm run db:validate
npm run db:generate
npm run db:migrate
npm run db:status
npm run db:seed
npm run db:seed
npm test
npm run test:db
```

`db:migrate` uses `prisma migrate deploy` to apply the two checked-in migrations without a shadow database or reset. Seed is explicit in Prisma 7; migration does not automatically run it. Do not use `db push`: the custom SQL constraints/triggers are part of the migration history. Future schema edits should use a new migration with `prisma migrate dev --create-only` on an isolated development/shadow setup; review custom SQL before application.

The database verification script inserts synthetic fixtures via the seed twice, checks repeatability, then rolls back all scenario changes. It does not remove existing data. Use a fresh dedicated database: it expects the seeded stock price to remain 50. Never run it against production/shared or real data. Run seed commands serially; concurrent seed runs are not supported. Failures return a nonzero exit code, not a skipped/passing integration result.

## Tables and constraints

| Table | Purpose / rules |
| --- | --- |
| User | Domain identity: id/name/unique email only. Synthetic `.invalid` addresses; no password, token, Account or Session tables. Phase 3 must migrate/reconcile it with the selected auth adapter before anyone can sign in. |
| Portfolio | USD-only name/id; ownership is Membership, not a second owner column. |
| Membership | Unique `(userId, portfolioId)` with OWNER/EDITOR/VIEWER enum and foreign keys. |
| Position | Portfolio FK, STOCK/CRYPTO/CASH, label/symbol, `unitPrice Decimal(28,8)`, required timezone-aware `priceAsOf`; no stored balance. Symbol is uppercase/trimmed. CASH requires symbol USD and price exactly 1, so the compound symbol uniqueness allows one cash position per portfolio. |
| PositionMovement | Composite `(positionId, portfolioId)` FK prevents a position from being paired with another portfolio. `signedQuantity Decimal(28,10)` is finite/nonzero; creator references User; `occurredAt` is the supplied event time, `createdAt` records insertion time. Nonempty `requestKey` is globally unique per operation. |

Initial migration is generated from the schema. The second SQL migration adds USD-only, nonnegative finite price, cash price/symbol, nonempty-label/requestKey and nonzero finite quantity constraints; it also installs statement triggers rejecting movement UPDATE, DELETE and TRUNCATE. Foreign keys use RESTRICT, preserving referenced history. Corrections require a new movement with a new request key.

Unique request keys prevent duplicate inserts; future write services must distinguish an identical retry from reuse with a different payload. Uniqueness alone is not a complete idempotent API. Request keys must describe an operation, not only a position.

Database owners/superusers can drop or disable triggers. Before public routes exist, use a separate non-owner runtime role with only the necessary SELECT/INSERT/UPDATE grants and no movement UPDATE/DELETE/TRUNCATE or schema DDL. This phase has no publicly reachable database path and does not claim production privilege hardening.

PostgreSQL fixed-scale NUMERIC can round excess input scale. The later write boundary must validate precision/range, cash cents, future observation times, role permissions and nonnegative resulting balances under a transaction/lock before insertion. Those concurrent-write rules are not implemented here. The valuation function rejects invalid prices/nonfinite inputs/zero deltas/negative final balances and cash fractions below cents, but a read check is not a safe write boundary.

## Synthetic seed and example

Seed uses stable IDs and insert-if-missing upserts. It never updates existing movement rows or deletes/reset data. For an existing movement requestKey it verifies the immutable payload; a conflict aborts the seed transaction. Existing portfolio names/prices/roles are preserved, so seed is not a reset command. Auth phase migrations must preserve/remap IDs referenced by history; no temporary credentials are assumed.

| User | Portfolio A | Portfolio B |
| --- | --- | --- |
| demo-owner | Owner | Viewer |
| demo-editor | Editor | No membership |
| demo-viewer | Viewer | No membership |
| demo-other-owner | No membership | Owner |

- Portfolio A: stock movements `+12 -2 = 10` at manual price USD 50 = USD 500; cash +100 at fixed USD 1 = USD 100; total **600**.
- Add a signed +2 stock movement at unchanged price 50: `12 * 50 + 100 = 700`; cash remains 100. The database scenario rolls back this temporary movement.
- A separate price-only scenario changes manual price to 60: `10 * 60 + 100 = 700`. It rolls back that price change before testing the +2 movement. Final seed state stays at 600 if the full verification passes.
- Portfolio B: synthetic crypto +0.25 at manual price 800 = **200**, isolated from A's total.
- Manual price/event timestamp for fixtures: 2026-10-24 10:00 UTC. These are illustrative values, not market data.
- The empty portfolio exists only inside a rolled-back integration scenario (and in a unit fixture), preserving the requested two permanent seeded portfolios.

## Server calculation and tests

`createDatabaseClient` validates configuration and constructs Prisma Client with `PrismaPg`; importing the module does not connect. `getPortfolioValuation(db, actorId, portfolioId)` reads a membership and its portfolio's positions/movements, rejects nonmembers, and passes the records to `calculateValuation`. The supplied actor is internal fixture context today, not authenticated identity. Phase 3 must provide it from a trusted server session. No route, action or AI tool exposes this function yet.

`calculateValuation` uses an isolated clone of Prisma.Decimal with 80 significant digits, no `Number`/parseFloat/arithmetic on money. It accepts decimal strings or Prisma Decimal values, sums signed movements, multiplies by price, sums unrounded values, and serializes decimal strings. Only `displayTotal` rounds to cents, half-up. It returns timestamps and zero allocation for zero totals. This is a current snapshot, not historical valuation or P&L.

- `npm test`: seven unit tests for both price-only and +2-unit 600 -> 700 changes, unchanged cash, exact fractions/tiny values, a large product, empty/zero portfolio, final-total rounding, and invalid numeric/cash inputs.
- `npm run test:db`: real PostgreSQL only; checks repeated seeds, role fixtures, scoped reads/nonmembers, both 600 -> 700 scenarios, fractions/empty portfolio, uniqueness/composite FK, price checks, and rejected UPDATE/DELETE on a temporary test movement. It inspects the enabled TRUNCATE trigger in metadata and never issues TRUNCATE. All scenario changes roll back. These checks remain unverified against PostgreSQL.

## Official version references

- [Prisma 7 generator/output](https://www.prisma.io/docs/orm/v7/prisma-schema/overview/generators)
- [Prisma 7 config URL](https://www.prisma.io/docs/orm/v7/reference/prisma-config-reference)
- [Prisma 7 PostgreSQL driver adapter](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql)
- [Prisma 7 explicit seeding](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/seeding)
- [Prisma CLI schema diff and migrations](https://www.prisma.io/docs/orm/v7/reference/prisma-cli-reference)
- [Custom migrations for triggers](https://www.prisma.io/docs/orm/v7/prisma-migrate/workflows/unsupported-database-features)
- [Prisma Decimal values](https://www.prisma.io/docs/orm/v7/prisma-client/special-fields-and-types)
- [Decimal clone/precision/rounding](https://mikemcl.github.io/decimal.js/)
- [PostgreSQL 17 numeric types](https://www.postgresql.org/docs/17/datatype-numeric.html), [constraints](https://www.postgresql.org/docs/17/ddl-constraints.html), [triggers](https://www.postgresql.org/docs/17/trigger-definition.html)
