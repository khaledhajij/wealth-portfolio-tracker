import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaClient } from "../generated/prisma/client";
import { portfolioInput } from "../lib/server/contracts";
import { createPortfolioService } from "../lib/server/portfolio-service";

// These doubles exercise service boundaries. PostgreSQL rollback is separately
// checked by test:ui; a successful mock transaction is not database evidence.
test("portfolio names are trimmed, bounded, and reject authority/currency fields", () => {
  assert.deepEqual(portfolioInput.parse({ name: "  My portfolio  " }), { name: "My portfolio" });
  assert.equal(portfolioInput.parse({ name: "a".repeat(100) }).name.length, 100);
  for (const input of [null, {}, { name: 3 }, { name: "" }, { name: " \n " }, { name: "a".repeat(101) },
    ...["userId", "ownerId", "role", "currency"].map((key) => ({ name: "Valid", [key]: "injected" }))]) {
    assert.equal(portfolioInput.safeParse(input).success, false);
  }
});

test("new portfolio and Owner membership use the same transaction and trusted user", async () => {
  const calls: string[] = [];
  const tx = {
    portfolio: { create: async (args: unknown) => {
      calls.push("portfolio");
      assert.deepEqual(args, { data: { name: "Savings", currency: "USD" }, select: { id: true, name: true, currency: true } });
      return { id: "new-id", name: "Savings", currency: "USD" };
    } },
    membership: { create: async (args: unknown) => {
      calls.push("membership");
      assert.deepEqual(args, { data: { userId: "trusted-viewer-elsewhere", portfolioId: "new-id", role: "OWNER" } });
    } },
  };
  const db = { $transaction: async (fn: (value: unknown) => Promise<unknown>) => fn(tx) } as unknown as PrismaClient;
  const service = createPortfolioService(db, async () => ({ id: "trusted-viewer-elsewhere" }));
  assert.deepEqual(await service.createPortfolio({ name: " Savings " }), { id: "new-id", name: "Savings", currency: "USD", role: "OWNER" });
  assert.deepEqual(calls, ["portfolio", "membership"]);
  const failure = new Error("Synthetic membership insertion failure");
  tx.membership.create = async () => { throw failure; };
  await assert.rejects(service.createPortfolio({ name: "Savings" }), (error) => error === failure);
});

test("list service filters membership by session user and returns minimal DTOs", async () => {
  let userId = "alice";
  const db = { membership: { findMany: async (args: { where: unknown; select: unknown }) => {
    assert.deepEqual(args.where, { userId, role: { in: ["OWNER", "EDITOR", "VIEWER"] } });
    assert.deepEqual(args.select, { role: true, portfolio: { select: { id: true, name: true, currency: true } } });
    return userId === "alice" ? [{ role: "VIEWER", portfolio: { id: "visible", name: "Shared", currency: "USD" } }] : [];
  } } } as unknown as PrismaClient;
  const service = createPortfolioService(db, async () => ({ id: userId }));
  assert.deepEqual(await service.listPortfolios(), [{ id: "visible", name: "Shared", currency: "USD", role: "VIEWER" }]);
  userId = "bob";
  assert.deepEqual(await service.listPortfolios(), []);
});
