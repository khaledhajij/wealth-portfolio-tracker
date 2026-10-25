import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { createServer } from "node:net";
import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { createDatabaseClient } from "../lib/server/db";
import type { PrismaClient } from "../generated/prisma/client";
import { createPortfolioService } from "../lib/server/portfolio-service";
import { createReadTools } from "../lib/server/assistant-tools";
import { createAuth } from "../lib/server/auth";
import { ServiceError } from "../lib/server/service-error";
import { positionsOutput, summaryOutput } from "../lib/chat-contracts";
import { demoPassword } from "../prisma/seed-auth";
import { seedUsers } from "../prisma/seed-data";

nextEnv.loadEnvConfig(process.cwd());
type Service = ReturnType<typeof createPortfolioService>;
type Summary = Awaited<ReturnType<Service["getSummary"]>>;
type Position = Awaited<ReturnType<Service["getPosition"]>>;
type Movement = Awaited<ReturnType<Service["recordMovement"]>>;
type PositionList = Awaited<ReturnType<Service["listPositions"]>>;
let stage = "read-only migration preflight";
let server: ChildProcess | undefined;
let origin = "";
const cookies: string[] = [];

async function freePort() {
  const probe = createServer();
  await new Promise<void>((resolve, reject) => { probe.once("error", reject); probe.listen(0, "127.0.0.1", resolve); });
  const address = probe.address();
  assert.ok(address && typeof address !== "string");
  await new Promise<void>((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function startServer(applicationName: string) {
  assert.ok(existsSync(".next/BUILD_ID"), "Run npm run build first");
  const port = await freePort();
  origin = `http://127.0.0.1:${port}`;
  const url = new URL(process.env.DATABASE_URL!);
  url.searchParams.set("application_name", applicationName);
  // Secrets travel only through the child environment, never command-line/log output.
  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", String(port)], {
    // This regression verifier must never contact or charge a model provider.
    env: { ...process.env, NODE_ENV: "production", BETTER_AUTH_URL: origin, DATABASE_URL: url.toString(), GOOGLE_GENERATIVE_AI_API_KEY: "", AI_MODEL: "" },
    stdio: "ignore", windowsHide: true,
  });
  let spawnFailed = false;
  server.once("error", () => { spawnFailed = true; });
  const deadline = Date.now() + 20000;
  while (Date.now() < deadline) {
    if (spawnFailed || server.exitCode !== null) throw new Error("Local verification server failed to start");
    try { if ((await fetch(`${origin}/sign-in`, { signal: AbortSignal.timeout(1000) })).ok) return; } catch { /* Wait for startup. */ }
    await delay(100);
  }
  throw new Error("Local verification server startup timed out");
}

async function call<T>(path: string, method: string, cookie: string, body?: unknown, expected = 200, extraHeaders: Record<string, string> = {}) {
  const response = await fetch(`${origin}${path}`, { method,
    headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json", ...extraHeaders },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(45000),
  });
  assert.equal(response.status, expected, "Unexpected HTTP status");
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  const json: unknown = await response.json();
  if (expected >= 400) {
    assert.ok(json && typeof json === "object");
    assert.deepEqual(Object.keys(json).sort(), ["code", "error"]);
    assert.equal(typeof (json as Record<string, unknown>).code, "string");
    assert.equal(typeof (json as Record<string, unknown>).error, "string");
  }
  return json as T;
}

async function verify(db: PrismaClient) {
  const local = readdirSync("prisma/migrations").filter((name) => !name.endsWith(".toml"));
  const history = await db.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`
    SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY started_at`;
  assert.equal(history.length, local.length, "Review migration history first");
  for (const name of local) {
    const row = history.find((entry) => entry.migration_name === name);
    assert.ok(row?.finished_at && !row.rolled_back_at, "Apply migrations before verification");
    assert.equal(row.checksum, createHash("sha256").update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest("hex"));
  }
  for (const user of seedUsers) {
    assert.equal((await db.user.findUnique({ where: { id: user.id } }))?.email, user.email, "Seed demo accounts first");
  }
  stage = "local HTTP server and real credential sessions";
  const runId = randomUUID();
  const applicationName = `wealth-phase4-${runId}`;
  await startServer(applicationName);
  for (const user of seedUsers) {
    const response = await fetch(`${origin}/api/auth/sign-in/email`, { method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email: user.email, password: demoPassword(), rememberMe: false }), signal: AbortSignal.timeout(20000),
    });
    assert.equal(response.status, 200, "Real credential login must succeed");
    const values = response.headers.getSetCookie();
    assert.ok(values.some((value) => value.includes(".session_token=")));
    cookies.push(values.map((value) => value.split(";")[0]).join("; "));
  }
  const [owner, editor, viewer, other] = cookies;
  stage = "isolated synthetic verification fixture";
  const portfolioId = `verify-p4:${runId}`;
  const foreignId = `verify-p4-other:${runId}`;
  // New synthetic resources only. Never edit existing memberships or reset balances.
  await db.$transaction(async (tx) => {
    await tx.portfolio.create({ data: { id: portfolioId, name: "[Synthetic verification] Phase 4" } });
    await tx.portfolio.create({ data: { id: foreignId, name: "[Synthetic verification] Phase 4 isolation" } });
    for (const [userId, role] of [["demo-owner", "OWNER"], ["demo-editor", "EDITOR"], ["demo-viewer", "VIEWER"]] as const) {
      await tx.membership.create({ data: { userId, role, portfolioId } });
    }
    await tx.membership.create({ data: { userId: "demo-other-owner", role: "OWNER", portfolioId: foreignId } });
    await tx.membership.create({ data: { userId: "demo-owner", role: "VIEWER", portfolioId: foreignId } });
  }, { timeout: 30000 });
  const base = `/api/portfolios/${portfolioId}`;
  const observedAt = new Date().toISOString();
  const positionBody = { assetType: "STOCK", label: "Synthetic API test", symbol: "TEST", unitPrice: "50", priceAsOf: observedAt };
  const movementBody = { signedQuantity: "10", occurredAt: observedAt, requestKey: randomUUID() };

  stage = "HTTP access matrix and strict validation";
  assert.equal((await call<Summary>(`${base}/summary`, "GET", owner)).totalValue, "0");
  for (const cookie of [owner, editor, viewer]) assert.deepEqual(await call(`${base}/positions`, "GET", cookie), []);
  const stock = await call<Position>(`${base}/positions`, "POST", owner, positionBody, 201);
  const stockPath = `${base}/positions/${stock.id}`;
  const cash = await call<Position>(`${base}/positions`, "POST", editor, { ...positionBody, assetType: "CASH", label: "Synthetic cash", symbol: "USD", unitPrice: "1" }, 201);
  const foreign = await call<Position>(`/api/portfolios/${foreignId}/positions`, "POST", other, positionBody, 201);
  for (const path of [`${base}/summary`, `${base}/positions`, `${stockPath}/movements`]) {
    await call(path, "GET", "", undefined, 401);
    await call(path, "GET", other, undefined, 404);
  }
  for (const [path, method, body] of [
    [`${base}/positions`, "POST", positionBody],
    [`${stockPath}/movements`, "POST", movementBody],
    [`${stockPath}/valuation`, "PATCH", { unitPrice: "60", priceAsOf: observedAt }],
  ] as const) {
    await call(path, method, "", body, 401);
    await call(path, method, viewer, body, 403, { "x-user-id": "demo-owner", "x-role": "OWNER" });
    await call(path, method, other, body, 404);
  }
  const foreignPath = `${base}/positions/${foreign.id}`;
  await call(foreignPath, "GET", owner, undefined, 404);
  await call(`${foreignPath}/movements`, "GET", owner, undefined, 404);
  await call(`${foreignPath}/movements`, "POST", owner, movementBody, 404);
  await call(`${foreignPath}/valuation`, "PATCH", owner, { unitPrice: "2", priceAsOf: observedAt }, 404);
  await call(`${base}/positions`, "POST", owner, positionBody, 409);
  for (const body of [
    { ...positionBody, userId: "demo-owner" }, { ...positionBody, role: "OWNER" },
    { ...positionBody, unitPrice: "-1" }, { ...positionBody, unitPrice: 50 },
    { ...positionBody, unitPrice: "0.123456789" }, { ...positionBody, priceAsOf: "2999-01-01T00:00:00Z" },
    { ...positionBody, assetType: "CASH", symbol: "USD", unitPrice: "2" },
  ]) await call(`${base}/positions`, "POST", owner, body, 400);
  for (const signedQuantity of ["0", "-0.0", "NaN", "1e2", "0.12345678901", 1]) {
    await call(`${stockPath}/movements`, "POST", owner, { ...movementBody, signedQuantity }, 400);
  }
  await call(`${stockPath}/movements`, "POST", owner, { ...movementBody, createdBy: "demo-editor" }, 400);
  await call(`${stockPath}/valuation`, "PATCH", owner, { unitPrice: "60", priceAsOf: observedAt }, 403, { Origin: "https://untrusted.example.invalid" });
  const malformed = await fetch(`${origin}${stockPath}/movements`, { method: "POST", headers: { Cookie: owner, Origin: origin, "Content-Type": "application/json" }, body: "{", signal: AbortSignal.timeout(20000) });
  assert.equal(malformed.status, 400);
  console.log("PASS: HTTP session/role/nonmember/resource isolation, sanitized errors, invalid input and origin checks");

  stage = "chat HTTP authorization before provider configuration";
  const question = { portfolioId, message: "Summarize this portfolio" };
  await call("/api/chat", "POST", "", question, 401);
  await call("/api/chat", "POST", other, question, 404);
  for (const cookie of [owner, editor, viewer]) await call("/api/chat", "POST", cookie, question, 503);
  for (const field of ["userId", "role", "messages", "tools"]) {
    await call("/api/chat", "POST", owner, { ...question, [field]: "untrusted" }, 400);
  }
  await call("/api/chat", "POST", owner, { ...question, message: "x".repeat(2001) }, 400);
  await call("/api/chat", "POST", viewer, { ...question, portfolioId: foreignId }, 404);
  console.log("PASS: chat session/membership/scope/input gates and explicit disabled-provider response; no provider contacted");

  stage = "Decimal valuations and duplicate requests over HTTP";
  const opening = await call<Movement>(`${stockPath}/movements`, "POST", owner, movementBody);
  assert.deepEqual(await call(`${stockPath}/movements`, "POST", owner, movementBody), opening);
  await call(`${stockPath}/movements`, "POST", owner, { ...movementBody, signedQuantity: "11" }, 409);
  await call(`${stockPath}/movements`, "POST", editor, movementBody, 409);
  await call(`${stockPath}/movements`, "POST", editor, { ...movementBody, signedQuantity: "-11", requestKey: randomUUID() }, 400);
  await call(`${base}/positions/${cash.id}/movements`, "POST", editor, { ...movementBody, signedQuantity: "100", requestKey: randomUUID() });
  await call(`${base}/positions/${cash.id}/movements`, "POST", owner, { ...movementBody, signedQuantity: "0.001", requestKey: randomUUID() }, 400);
  await call(`${base}/positions/${cash.id}/valuation`, "PATCH", owner, { unitPrice: "2", priceAsOf: observedAt }, 400);
  assert.equal((await call<Summary>(`${base}/summary`, "GET", viewer)).totalValue, "600");
  await call(`${stockPath}/valuation`, "PATCH", editor, { unitPrice: "60", priceAsOf: observedAt });
  const repriced = await call<Summary>(`${base}/summary`, "GET", owner);
  assert.equal(repriced.totalValue, "700");
  assert.equal(repriced.positions.find((row) => row.id === stock.id)?.quantity, "10");
  assert.equal(repriced.positions.find((row) => row.id === stock.id)?.unitPrice, "60");
  await call(stockPath, "PATCH", owner, { unitPrice: "50", priceAsOf: observedAt }); // Existing route stays compatible.
  await call(`${stockPath}/movements`, "POST", editor, { ...movementBody, signedQuantity: "2", requestKey: randomUUID() });
  assert.equal((await call<Summary>(`${base}/summary`, "GET", editor)).totalValue, "700");
  const rows = await call<PositionList>(`${base}/positions`, "GET", viewer);
  assert.equal(rows.find((row) => row.id === stock.id)?.quantity, "12");
  assert.equal(rows.find((row) => row.id === cash.id)?.quantity, "100");
  assert.equal((await db.positionMovement.findUniqueOrThrow({ where: { requestKey: movementBody.requestKey } })).createdBy, "demo-owner");
  assert.equal((await db.position.findUniqueOrThrow({ where: { id: stock.id } })).priceUpdatedBy, "demo-owner");
  const fraction = await call<Position>(`${base}/positions`, "POST", owner, { ...positionBody, symbol: "FRACTION", unitPrice: "0.1" }, 201);
  for (const signedQuantity of ["0.1", "0.2"]) await call(`${base}/positions/${fraction.id}/movements`, "POST", owner, { ...movementBody, signedQuantity, requestKey: randomUUID() });
  assert.equal((await call<PositionList>(`${base}/positions`, "GET", viewer)).find((row) => row.id === fraction.id)?.value, "0.03");
  console.log("PASS: 600 -> 700, unchanged cash, exact fractions, request-key replay/conflict and server-derived actors");

  stage = "real-session secured AI read tools on synthetic PostgreSQL fixtures";
  const auth = createAuth(db, { ...process.env, BETTER_AUTH_URL: origin });
  const readService = createPortfolioService(db, async () => {
    const session = await auth.api.getSession({ headers: new Headers({ Cookie: viewer }), query: { disableCookieCache: true } });
    if (!session || session.session.expiresAt <= new Date()) throw new ServiceError(401, "Sign in required.");
    return { id: session.user.id };
  });
  const context = await readService.authorizePortfolioRead(portfolioId);
  const tools = createReadTools(readService, context, new AbortController().signal);
  const options = { toolCallId: "synthetic-db-check", messages: [], context: {} };
  const toolSummary = summaryOutput.parse(await tools.getPortfolioSummary.execute!({}, options));
  assert.equal(toolSummary.totalValue, "700.03");
  assert.equal(toolSummary.manualPriceWindow.oldest, observedAt);
  const toolPositions = positionsOutput.parse(await tools.listPositions.execute!({}, options));
  assert.equal(toolPositions.positions.find((row) => row.symbol === "TEST")?.quantity, "12");
  assert.equal(toolPositions.positions.find((row) => row.symbol === "USD")?.quantity, "100");
  await assert.rejects(async () => tools.listPositions.execute!({ portfolioId: foreignId, role: "OWNER" } as unknown as Record<string, never>, options));
  await assert.rejects(readService.authorizePortfolioRead(foreignId));
  console.log("PASS: real-session AI tools reuse secured Decimal services, exact 700.03/timestamps and reject foreign scope; no provider contacted");

  stage = "concurrency fixture setup";
  const race = await call<Position>(`${base}/positions`, "POST", owner, { ...positionBody, symbol: "RACE", unitPrice: "1" }, 201);
  const racePath = `${base}/positions/${race.id}/movements`;
  await call(racePath, "POST", owner, { ...movementBody, requestKey: randomUUID() });
  let release!: () => void;
  let locked!: () => void;
  const held = new Promise<void>((resolve) => { release = resolve; });
  const ready = new Promise<void>((resolve) => { locked = resolve; });
  let guardPid = 0;
  stage = "concurrency guard acquisition";
  const guard = db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT id FROM "Position" WHERE id = ${race.id} FOR UPDATE`;
    const backend = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    guardPid = backend[0].pid;
    locked(); await held;
  }, { timeout: 45000 });
  // Attach immediately so a guard error cannot become an unhandled rejection.
  const guardOutcome = guard.then(() => null, (error: unknown) => error);
  const readiness = await Promise.race([ready.then(() => true), guardOutcome.then(() => false)]);
  assert.ok(readiness, "Could not acquire concurrency verification lock");
  const decreases = [owner, editor].map((cookie) => fetch(`${origin}${racePath}`, { method: "POST",
    headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({ ...movementBody, signedQuantity: "-8", requestKey: randomUUID() }), signal: AbortSignal.timeout(45000),
  }));
  const results = Promise.allSettled(decreases);
  let overlapObserved = false;
  let maxBlockedQueries = 0;
  let maxTaggedQueries = 0;
  let observationFailed = false;
  stage = "observing overlapping PostgreSQL lock waits";
  try {
    const deadline = Date.now() + 12000;
    while (Date.now() < deadline) {
      // Follow the actual blocker graph, including queued/soft blockers. A pooler
      // may replace application_name, so it is diagnostic only, never the gate.
      const waiting = await db.$queryRaw<{ blocked_count: bigint; tagged_count: bigint }[]>`
        WITH RECURSIVE blocked(pid) AS (
          SELECT a.pid FROM pg_stat_activity a WHERE ${guardPid} = ANY(pg_blocking_pids(a.pid))
          UNION
          SELECT a.pid FROM pg_stat_activity a JOIN blocked b ON b.pid = ANY(pg_blocking_pids(a.pid))
        )
        SELECT count(*) AS blocked_count,
          count(*) FILTER (WHERE a.application_name = ${applicationName}) AS tagged_count
        FROM pg_stat_activity a
        WHERE a.pid IN (SELECT pid FROM blocked) AND a.state = 'active' AND a.wait_event_type = 'Lock'
          AND a.query LIKE '%"Position"%' AND a.query LIKE '%FOR UPDATE%'`;
      maxBlockedQueries = Math.max(maxBlockedQueries, Number(waiting[0].blocked_count));
      maxTaggedQueries = Math.max(maxTaggedQueries, Number(waiting[0].tagged_count));
      if (maxBlockedQueries >= 2) { overlapObserved = true; break; }
      await delay(250);
    }
  } catch {
    observationFailed = true; // Do not log raw SQL/connection error details.
  } finally { release(); }
  const responses = await results;
  const guardSucceeded = await guardOutcome === null;
  const statuses: number[] = [];
  const requestResults: { status?: number; code?: string; transportFailure?: boolean }[] = [];
  for (const result of responses) {
    if (result.status === "rejected") { requestResults.push({ transportFailure: true }); continue; }
    const response = result.value;
    statuses.push(response.status);
    let code: string | undefined;
    try {
      const body: unknown = await response.json();
      const value = body && typeof body === "object" && "code" in body ? body.code : undefined;
      if (typeof value === "string" && ["INVALID_REQUEST", "UNAUTHENTICATED", "FORBIDDEN", "NOT_FOUND", "CONFLICT", "UNAVAILABLE"].includes(value)) code = value;
    } catch { /* Unexpected response remains visible as its HTTP status only. */ }
    requestResults.push({ status: response.status, ...(code ? { code } : {}) });
  }
  stage = "concurrency final balance read";
  const balance = await db.positionMovement.aggregate({ where: { positionId: race.id, portfolioId }, _sum: { signedQuantity: true } });
  const movementCount = await db.positionMovement.count({ where: { positionId: race.id } });
  console.log(JSON.stringify({ check: "concurrent-decreases", overlapObserved, observationFailed,
    maxBlockedQueries, maxTaggedQueries, guardSucceeded, requests: requestResults,
    finalQuantity: balance._sum.signedQuantity?.toFixed() ?? "0", movementCount }));
  stage = "concurrency guard completion";
  assert.ok(guardSucceeded, "Concurrency guard transaction failed");
  stage = "concurrency overlap evidence";
  assert.ok(overlapObserved && !observationFailed, "Two overlapping SQL lock waits must be observed; concurrent scheduling is otherwise unverified");
  stage = "concurrent decrease response statuses";
  assert.equal(responses.every((result) => result.status === "fulfilled"), true, "A concurrent HTTP request failed in transport");
  assert.deepEqual(statuses.sort(), [200, 400], "Only one withdrawal of 8 may succeed from quantity 10");
  stage = "concurrent decrease balance assertions";
  assert.equal(balance._sum.signedQuantity?.toFixed(), "2");
  assert.equal(movementCount, 2);
  console.log("PASS: observed two overlapping SQL lock waits; one -8 accepted, one rejected, final quantity 2");

  stage = "simultaneous duplicate submission";
  const duplicate = { ...movementBody, signedQuantity: "1", requestKey: randomUUID() };
  const duplicateResults = await Promise.all([call<Movement>(racePath, "POST", owner, duplicate), call<Movement>(racePath, "POST", owner, duplicate)]);
  assert.equal(duplicateResults[0].id, duplicateResults[1].id);
  assert.equal(await db.positionMovement.count({ where: { requestKey: duplicate.requestKey } }), 1);
  console.log("PASS: simultaneous identical requestKey creates exactly one movement and returns the same DTO");
  console.log("Synthetic verification portfolios/history retained; no existing demo holdings or history were changed or deleted.");
}

let db: PrismaClient | undefined;
try { db = createDatabaseClient(); await verify(db); } catch (error) {
  console.error(`Phase 4 verification failed at ${stage} (${error instanceof assert.AssertionError ? "assertion" : error instanceof Error ? error.name : "unknown"}); connection details and credentials suppressed.`);
  process.exitCode = 1;
} finally {
  // Revoke only this run's library sessions, then stop only its own child process.
  if (origin) for (const cookie of cookies) {
    try { await fetch(`${origin}/api/auth/sign-out`, { method: "POST", headers: { Cookie: cookie, Origin: origin, "Content-Type": "application/json" }, body: "{}", signal: AbortSignal.timeout(5000) }); } catch { /* Server may already have exited. */ }
  }
  server?.kill();
  await db?.$disconnect();
}
