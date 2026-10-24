import nextEnv from "@next/env";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { createDatabaseClient } from "../lib/server/db";
import { createAuth } from "../lib/server/auth";
import { authSettings } from "../lib/server/auth-settings";
import { createPortfolioService } from "../lib/server/portfolio-service";
import { ServiceError } from "../lib/server/service-error";
import { seedDatabase } from "../prisma/seed";
import { demoPassword, seedDemoCredentials } from "../prisma/seed-auth";
import { seedUsers } from "../prisma/seed-data";

nextEnv.loadEnvConfig(process.cwd());
const rollback = new Error("Rollback auth service scenarios");
const denial = (status: number) => (error: unknown) => error instanceof ServiceError && error.status === status;
let stage = "configuration";

async function verify(db: PrismaClient) {
  stage = "read-only migration preflight";
  // Read migration state first; never seed against unapplied/unknown migrations.
  const local = readdirSync("prisma/migrations").filter((name) => !name.endsWith(".toml"));
  const history = await db.$queryRaw<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }[]>`
    SELECT migration_name, checksum, finished_at, rolled_back_at FROM public."_prisma_migrations" ORDER BY started_at`;
  assert.equal(history.length, local.length, "Inspect migration history before verification");
  for (const name of local) {
    const row = history.find((entry) => entry.migration_name === name);
    assert.ok(row?.finished_at && !row.rolled_back_at, "Apply pending migrations before verification");
    assert.equal(row.checksum, createHash("sha256").update(readFileSync(`prisma/migrations/${name}/migration.sql`)).digest("hex"));
  }
  stage = "synthetic credential seed";
  const password = demoPassword();
  await seedDatabase(db);
  await seedDemoCredentials(db, password);
  const accountQuery = { where: { userId: { in: seedUsers.map((user) => user.id) }, providerId: "credential" }, orderBy: { id: "asc" as const }, select: { id: true, password: true } };
  const first = await db.account.findMany(accountQuery);
  await seedDatabase(db); await seedDemoCredentials(db, password);
  assert.deepEqual(await db.account.findMany(accountQuery), first);
  assert.equal(first.length, 4);
  assert.ok(first.every((account) => account.password && account.password !== password));
  console.log("PASS: demo identities and salted password hashes are repeatable without resetting credentials");

  stage = "real session and service checks";
  const auth = createAuth(db);
  const settings = authSettings();
  const cookies: string[] = [];
  const request = (path: string, body: unknown, cookie = "", origin = settings.baseURL) => new Request(`${settings.baseURL}/api/auth${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: origin, ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body),
  });
  async function userFrom(cookie: string) {
    const session = await auth.api.getSession({ headers: new Headers({ Cookie: cookie }), query: { disableCookieCache: true } });
    if (!session || session.session.expiresAt <= new Date()) throw new ServiceError(401, "Sign in required.");
    return { id: session.user.id };
  }
  async function signIn(email: string) {
    const response = await auth.handler(request("/sign-in/email", { email, password, rememberMe: false }));
    assert.equal(response.status, 200, "Real credential sign-in must succeed");
    const setCookies = response.headers.getSetCookie();
    const token = setCookies.find((value) => value.split("=")[0].endsWith(".session_token"));
    assert.ok(token); assert.match(token, /httponly/i); assert.match(token, /samesite=lax/i);
    assert.equal(/;\s*secure(?:;|$)/i.test(token), settings.secure);
    const cookie = setCookies.map((value) => value.split(";")[0]).join("; ");
    cookies.push(cookie); return cookie;
  }
  try {
    await assert.rejects(userFrom(""), denial(401));
    const badPassword = await auth.handler(request("/sign-in/email", { email: seedUsers[0].email, password: `wrong-${randomUUID()}` }));
    assert.notEqual(badPassword.status, 200);
    const registration = await auth.handler(request("/sign-up/email", { email: "unwanted@example.invalid", password, name: "Not allowed" }));
    assert.notEqual(registration.status, 200);
    assert.equal(await db.user.count({ where: { email: "unwanted@example.invalid" } }), 0);
    const ownerCookie = await signIn(seedUsers[0].email);
    const editorCookie = await signIn(seedUsers[1].email);
    const viewerCookie = await signIn(seedUsers[2].email);
    const otherCookie = await signIn(seedUsers[3].email);
    const ownerService = createPortfolioService(db, () => userFrom(ownerCookie));
    const editorService = createPortfolioService(db, () => userFrom(editorCookie));
    const viewerService = createPortfolioService(db, () => userFrom(viewerCookie));
    const otherService = createPortfolioService(db, () => userFrom(otherCookie));
    for (const service of [ownerService, editorService, viewerService]) assert.equal((await service.getPortfolio("demo-primary")).id, "demo-primary");
    await assert.rejects(otherService.getPortfolio("demo-primary"), denial(404));
    await assert.rejects(editorService.getPortfolio("demo-secondary"), denial(404));
    await assert.rejects(ownerService.getPosition("demo-primary", "demo-crypto"), denial(404));
    await assert.rejects(ownerService.listMovements("demo-primary", "demo-crypto"), denial(404));
    const observedAt = new Date().toISOString();
    const price = { unitPrice: "1", priceAsOf: observedAt };
    const movement = { signedQuantity: "1", occurredAt: observedAt, requestKey: randomUUID() };
    const input = { ...price, assetType: "STOCK", symbol: "AUTHCHECK", label: "Synthetic auth check" };
    await assert.rejects(viewerService.addPosition("demo-primary", input), denial(403));
    await assert.rejects(viewerService.recordMovement("demo-primary", "demo-stock", movement), denial(403));
    await assert.rejects(viewerService.updatePrice("demo-primary", "demo-stock", price), denial(403));
    for (const service of [ownerService, editorService]) {
      await assert.rejects(service.recordMovement("demo-primary", "demo-crypto", movement), denial(404));
      await assert.rejects(service.updatePrice("demo-primary", "demo-crypto", price), denial(404));
    }
    await assert.rejects(otherService.addPosition("demo-primary", input), denial(404));
    await assert.rejects(otherService.recordMovement("demo-primary", "demo-stock", movement), denial(404));
    await assert.rejects(otherService.updatePrice("demo-primary", "demo-stock", price), denial(404));
    console.log("PASS: real sessions, all member reads, Viewer/nonmember write denials, cross-portfolio resource denials");

    // Successful write probes roll back; never modify or delete existing movement history.
    try {
      await db.$transaction(async (tx) => {
        const nested = new Proxy(tx, { get(target, key) {
          if (key === "$transaction") return (fn: (value: Prisma.TransactionClient) => Promise<unknown>) => fn(tx);
          return Reflect.get(target, key);
        } }) as unknown as PrismaClient;
        for (const cookie of [ownerCookie, editorCookie]) {
          const service = createPortfolioService(nested, () => userFrom(cookie));
          const added = await service.addPosition("demo-primary", { ...input, symbol: `AUTH-${randomUUID().slice(0, 8)}` });
          const operation = { ...movement, requestKey: randomUUID() };
          const recorded = await service.recordMovement("demo-primary", added.id, operation);
          assert.equal((await service.recordMovement("demo-primary", added.id, operation)).id, recorded.id);
          await assert.rejects(service.recordMovement("demo-primary", added.id, { ...operation, signedQuantity: "2" }), denial(409));
          await assert.rejects(service.recordMovement("demo-primary", added.id, { ...operation, requestKey: randomUUID(), signedQuantity: "-2" }), denial(400));
          await service.updatePrice("demo-primary", added.id, { ...price, unitPrice: "2" });
          assert.equal((await tx.position.findUniqueOrThrow({ where: { id: added.id } })).priceUpdatedBy, (await userFrom(cookie)).id);
          const cash = await service.addPosition("demo-secondary", { ...input, assetType: "CASH", symbol: "USD" }).catch((error: unknown) => {
            // Owner is only Viewer in B; Editor is nonmember. No cash row is inserted.
            assert.ok(error instanceof ServiceError && [403, 404].includes(error.status)); return null;
          });
          assert.equal(cash, null);
        }
        throw rollback;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 60000 });
    } catch (error) { if (error !== rollback) throw error; }
    console.log("PASS: Owner/Editor writes, movement retry/conflict/negative-balance checks and price actor; scenario writes rolled back");

    const forged = ownerCookie.replace(/(session_token=)[^;]+/, "$1forged");
    await assert.rejects(userFrom(forged), denial(401));
    const csrf = await auth.handler(request("/sign-out", {}, ownerCookie, "https://untrusted.example.invalid"));
    assert.notEqual(csrf.status, 200);
    assert.equal((await userFrom(ownerCookie)).id, seedUsers[0].id);
    // Expire only the session created by this verification, then let the library reject it.
    const expiringCookie = await signIn(seedUsers[2].email);
    const expiring = await auth.api.getSession({ headers: new Headers({ Cookie: expiringCookie }) });
    assert.ok(expiring);
    await db.session.update({ where: { id: expiring.session.id }, data: { expiresAt: new Date(0) } });
    await assert.rejects(userFrom(expiringCookie), denial(401));
    const signedOut = await auth.handler(request("/sign-out", {}, ownerCookie));
    assert.equal(signedOut.status, 200);
    await assert.rejects(userFrom(ownerCookie), denial(401));
    console.log("PASS: cookie flags, forged/expired sessions, cross-origin rejection and logout revocation");
  } finally {
    // Library revocation only for sessions created by this script; no global session reset.
    for (const cookie of cookies) await auth.handler(request("/sign-out", {}, cookie));
  }
}

let db: PrismaClient | undefined;
try {
  db = createDatabaseClient();
  await verify(db);
} catch (error) {
  console.error(`Authentication integration verification failed at ${stage} (${error instanceof assert.AssertionError ? "assertion" : error instanceof Error ? error.name : "unknown"}); secrets suppressed. Check migration state, credentials and connectivity.`);
  process.exitCode = 1;
} finally { await db?.$disconnect(); }
