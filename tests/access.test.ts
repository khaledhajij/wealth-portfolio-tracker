import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import { createPortfolioService } from "../lib/server/portfolio-service";
import { ServiceError } from "../lib/server/service-error";
import { movementInput, positionInput, priceInput } from "../lib/server/contracts";
import { authSettings } from "../lib/server/auth-settings";
import { mutationBody, api } from "../lib/server/http";
import { hashPassword, verifyPassword } from "better-auth/crypto";

const timestamp = "2026-01-01T00:00:00.000Z";
const movement = { signedQuantity: "2", occurredAt: timestamp, requestKey: "test-operation" };
const price = { unitPrice: "50", priceAsOf: timestamp };
const input = { ...price, assetType: "STOCK", symbol: "TEST", label: "Synthetic test" };
const status = (expected: number) => (error: unknown) => error instanceof ServiceError && error.status === expected;

// Unit test doubles verify denial before access/mutation. They are not live auth/DB evidence.
function fixture(initialRole: string | null = "OWNER", existingMovement?: {
  id: string; portfolioId: string; positionId: string; createdBy: string;
  signedQuantity: Prisma.Decimal; occurredAt: Date; note: string | null;
}) {
  let role = initialRole;
  let user: { id: string } | null = { id: "session-user" };
  let mutations = 0;
  let movementReads = 0;
  const locks: string[] = [];
  const row = { id: "position-a", portfolioId: "portfolio-a", assetType: "STOCK", label: "Test", symbol: "TEST",
    unitPrice: new Prisma.Decimal("50"), priceAsOf: new Date(timestamp), priceUpdatedBy: null, createdAt: new Date(), updatedAt: new Date() };
  const tx = {
    $queryRaw: async (parts: TemplateStringsArray) => { locks.push(parts.join("?")); return []; },
    membership: {
      findUnique: async (query: { where: { userId_portfolioId: { userId: string; portfolioId: string } } }) => {
        assert.equal(query.where.userId_portfolioId.userId, "session-user");
        return role && query.where.userId_portfolioId.portfolioId === "portfolio-a" ? {
          role, portfolio: { id: "portfolio-a", name: "Synthetic", positions: [{ ...row, movements: [{ signedQuantity: "10" }] }] },
        } : null;
      },
    },
    position: {
      findFirst: async (query: { where: { id: string; portfolioId: string } }) => query.where.id === row.id && query.where.portfolioId === row.portfolioId ? row : null,
      create: async () => { mutations++; return row; },
      update: async () => { mutations++; return row; },
    },
    positionMovement: {
      findUnique: async () => existingMovement ?? null,
      findMany: async () => { movementReads++; return []; },
      aggregate: async () => ({ _sum: { signedQuantity: new Prisma.Decimal("10") } }),
      create: async ({ data }: { data: { signedQuantity: string; occurredAt: Date } }) => {
        mutations++;
        return { ...data, id: "test-movement", signedQuantity: new Prisma.Decimal(data.signedQuantity), note: null };
      },
    },
  };
  const db = { ...tx, $transaction: async (fn: (value: unknown) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable"); return fn(tx);
  } } as unknown as PrismaClient;
  const service = createPortfolioService(db, async () => {
    if (!user) throw new ServiceError(401, "Sign in required.");
    return user;
  });
  return { service, db, tx, locks, setRole: (next: string | null) => { role = next; }, setAssetType: (next: string) => { row.assetType = next; }, signOut: () => { user = null; },
    mutations: () => mutations, movementReads: () => movementReads };
}

test("missing session rejects every service operation before database access", async () => {
  const f = fixture(); f.signOut();
  const operations = [
    () => f.service.listPortfolios(), () => f.service.getPortfolio("portfolio-a"),
    () => f.service.getPosition("portfolio-a", "position-a"), () => f.service.listMovements("portfolio-a", "position-a"),
    () => f.service.addPosition("portfolio-a", input), () => f.service.recordMovement("portfolio-a", "position-a", movement),
    () => f.service.updatePrice("portfolio-a", "position-a", price),
  ];
  for (const operation of operations) await assert.rejects(operation, status(401));
  assert.equal(f.locks.length, 0); assert.equal(f.mutations(), 0);
});

for (const role of ["OWNER", "EDITOR", "VIEWER"]) {
  test(`${role} reads valuation and scoped resources`, async () => {
    const f = fixture(role);
    assert.equal((await f.service.getPortfolio("portfolio-a")).valuation.totalValue, "500");
    assert.equal((await f.service.getPosition("portfolio-a", "position-a")).unitPrice, "50");
    assert.deepEqual(await f.service.listMovements("portfolio-a", "position-a"), []);
  });
}

test("Viewer cannot add positions, record movements or update prices", async () => {
  const f = fixture("VIEWER");
  await assert.rejects(f.service.addPosition("portfolio-a", input), status(403));
  await assert.rejects(f.service.recordMovement("portfolio-a", "position-a", movement), status(403));
  await assert.rejects(f.service.updatePrice("portfolio-a", "position-a", price), status(403));
  assert.equal(f.mutations(), 0);
});

test("nonmembers and unknown roles are denied for reads and writes", async () => {
  for (const role of [null, "ADMIN"]) {
    const f = fixture(role);
    await assert.rejects(f.service.getPortfolio("portfolio-a"), status(404));
    await assert.rejects(f.service.getPosition("portfolio-a", "position-a"), status(404));
    await assert.rejects(f.service.listMovements("portfolio-a", "position-a"), status(404));
    await assert.rejects(f.service.addPosition("portfolio-a", input), status(404));
    await assert.rejects(f.service.recordMovement("portfolio-a", "position-a", movement), status(404));
    await assert.rejects(f.service.updatePrice("portfolio-a", "position-a", price), status(404));
    assert.equal(f.mutations(), 0); assert.equal(f.movementReads(), 0);
  }
});

test("a position ID from another portfolio cannot be read or written", async () => {
  const f = fixture();
  await assert.rejects(f.service.getPosition("portfolio-a", "position-b"), status(404));
  await assert.rejects(f.service.listMovements("portfolio-a", "position-b"), status(404));
  await assert.rejects(f.service.recordMovement("portfolio-a", "position-b", movement), status(404));
  await assert.rejects(f.service.updatePrice("portfolio-a", "position-b", price), status(404));
  await assert.rejects(f.service.getPortfolio("portfolio-b"), status(404));
  assert.equal(f.mutations(), 0); assert.equal(f.movementReads(), 0);
});

for (const role of ["OWNER", "EDITOR"]) {
  test(`${role} can perform the three permitted writes`, async () => {
    const f = fixture(role);
    await f.service.addPosition("portfolio-a", input);
    await f.service.recordMovement("portfolio-a", "position-a", movement);
    await f.service.updatePrice("portfolio-a", "position-a", price);
    assert.equal(f.mutations(), 3);
    assert.ok(f.locks.some((query) => query.includes('"Position"') && query.includes("FOR UPDATE")));
  });
}

test("membership and identity are rechecked rather than cached", async () => {
  const f = fixture();
  await f.service.getPortfolio("portfolio-a");
  f.setRole("VIEWER");
  await assert.rejects(f.service.addPosition("portfolio-a", input), status(403));
  f.setRole(null);
  await assert.rejects(f.service.getPortfolio("portfolio-a"), status(404));
  f.signOut();
  await assert.rejects(f.service.getPortfolio("portfolio-a"), status(401));
});

test("request-key retries return the same movement but reject conflicting payloads and actors", async () => {
  const existing = { id: "original", portfolioId: "portfolio-a", positionId: "position-a", createdBy: "session-user",
    signedQuantity: new Prisma.Decimal("2"), occurredAt: new Date(timestamp), note: null };
  const f = fixture("OWNER", existing);
  assert.equal((await f.service.recordMovement("portfolio-a", "position-a", movement)).id, "original");
  await assert.rejects(f.service.recordMovement("portfolio-a", "position-a", { ...movement, signedQuantity: "3" }), status(409));
  const other = fixture("OWNER", { ...existing, createdBy: "another-user" });
  await assert.rejects(other.service.recordMovement("portfolio-a", "position-a", movement), status(409));
  assert.equal(f.mutations(), 0); assert.equal(other.mutations(), 0);
});

test("cash stays at unit price 1 and rejects fractional cents", async () => {
  const f = fixture(); f.setAssetType("CASH");
  await assert.rejects(f.service.updatePrice("portfolio-a", "position-a", { ...price, unitPrice: "2" }), status(400));
  await assert.rejects(f.service.recordMovement("portfolio-a", "position-a", { ...movement, signedQuantity: "0.001" }), status(400));
  await assert.rejects(f.service.addPosition("portfolio-a", { ...input, assetType: "CASH", symbol: "USD", unitPrice: "2" }), status(400));
  assert.equal(f.mutations(), 0);
});

test("serialization conflicts retry at most three transactions", async () => {
  const f = fixture();
  let attempts = 0;
  f.db.$transaction = (async () => {
    attempts++;
    throw new Prisma.PrismaClientKnownRequestError("Synthetic conflict", { code: "P2034", clientVersion: "7.10.1" });
  }) as typeof f.db.$transaction;
  await assert.rejects(f.service.addPosition("portfolio-a", input), status(409));
  assert.equal(attempts, 3); assert.equal(f.mutations(), 0);
});

test("writes reject identity injection, invalid scales, future times and negative balances", async () => {
  assert.equal(positionInput.safeParse({ ...input, userId: "owner" }).success, false);
  assert.equal(movementInput.safeParse({ ...movement, createdBy: "owner", role: "OWNER" }).success, false);
  for (const value of [0, "0", "NaN", "1e3", "0.12345678901"]) assert.equal(movementInput.safeParse({ ...movement, signedQuantity: value }).success, false);
  for (const value of [-1, "-1", "Infinity", "1.123456789"]) assert.equal(priceInput.safeParse({ ...price, unitPrice: value }).success, false);
  assert.equal(priceInput.safeParse({ ...price, priceAsOf: "2999-01-01T00:00:00Z" }).success, false);
  const f = fixture();
  await assert.rejects(f.service.recordMovement("portfolio-a", "position-a", { ...movement, signedQuantity: "-11" }), status(400));
  assert.equal(f.mutations(), 0);
});

test("private HTTP responses never cache, and unknown errors are sanitized", async () => {
  const response = await api(async () => { throw new Error("private connection detail"); });
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal((await response.text()).includes("private connection detail"), false);
});

test("remote HTTP is rejected, loopback HTTP and remote HTTPS have appropriate cookie settings", () => {
  const env = { BETTER_AUTH_SECRET: "test-only-secret-with-at-least-32-characters", BETTER_AUTH_URL: "http://localhost:3000" };
  assert.equal(authSettings(env).secure, false);
  assert.equal(authSettings({ ...env, BETTER_AUTH_URL: "https://demo.example.invalid" }).secure, true);
  assert.throws(() => authSettings({ ...env, BETTER_AUTH_URL: "http://demo.example.invalid" }));
  assert.throws(() => authSettings({ ...env, BETTER_AUTH_SECRET: "short" }));
});

test("mutations reject cross-origin, missing origin and oversized actual bodies", async () => {
  const previous = { secret: process.env.BETTER_AUTH_SECRET, url: process.env.BETTER_AUTH_URL };
  process.env.BETTER_AUTH_SECRET = "test-only-secret-with-at-least-32-characters";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  try {
    for (const origin of [undefined, "https://other.example.invalid"]) {
      const request = new Request("http://localhost:3000/api/portfolios", { method: "POST", headers: { "content-type": "application/json", ...(origin ? { origin } : {}) }, body: "{}" });
      await assert.rejects(mutationBody(request), status(403));
    }
    const headers = { "content-type": "application/json", origin: "http://localhost:3000" };
    await assert.rejects(mutationBody(new Request("http://localhost:3000", { method: "POST", headers, body: JSON.stringify({ note: "x".repeat(9000) }) })), status(400));
  } finally {
    if (previous.secret === undefined) delete process.env.BETTER_AUTH_SECRET; else process.env.BETTER_AUTH_SECRET = previous.secret;
    if (previous.url === undefined) delete process.env.BETTER_AUTH_URL; else process.env.BETTER_AUTH_URL = previous.url;
  }
});

test("Better Auth hashes verify the correct password and reject a wrong password", async () => {
  const password = "synthetic-unit-test-password";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, password); assert.notEqual(first, second);
  assert.equal(await verifyPassword({ hash: first, password }), true);
  assert.equal(await verifyPassword({ hash: first, password: "incorrect-password" }), false);
});
