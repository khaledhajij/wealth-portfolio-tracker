import assert from "node:assert/strict";
import nextEnv from "@next/env";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { createDatabaseClient } from "../lib/server/db";
import { getPortfolioValuation } from "./fixture-valuation";
import { seedDatabase } from "../prisma/seed";
import { seedMovements, seedTime } from "../prisma/seed-data";

nextEnv.loadEnvConfig(process.cwd());
const rollback = new Error("Rollback verification changes");

async function expectDatabaseFailure(tx: Prisma.TransactionClient, operation: () => Promise<unknown>, pattern: RegExp) {
  await tx.$executeRawUnsafe("SAVEPOINT expected_failure");
  let rejected: unknown;
  try { await operation(); } catch (error) { rejected = error; }
  await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT expected_failure");
  await tx.$executeRawUnsafe("RELEASE SAVEPOINT expected_failure");
  assert.ok(rejected instanceof Error, "Expected the database to reject an invalid write");
  assert.match(rejected.message, pattern);
}

async function verify(db: PrismaClient) {
  await seedDatabase(db);
  const countBefore = await db.positionMovement.count();
  await seedDatabase(db);
  assert.equal(await db.positionMovement.count(), countBefore, "Repeated seed must not duplicate movements");
  assert.equal(await db.portfolio.count({ where: { id: { in: ["demo-primary", "demo-secondary"] } } }), 2);
  const primary = await getPortfolioValuation(db, "demo-owner", "demo-primary");
  assert.equal(primary.totalValue, "600", "Use a fresh dedicated verification database");
  assert.equal((await getPortfolioValuation(db, "demo-other-owner", "demo-secondary")).totalValue, "200");
  assert.equal((await getPortfolioValuation(db, "demo-viewer", "demo-primary")).totalValue, "600");
  await assert.rejects(getPortfolioValuation(db, "demo-editor", "demo-secondary"), /inaccessible/);
  await assert.rejects(getPortfolioValuation(db, "demo-other-owner", "demo-primary"), /inaccessible/);
  console.log("PASS: seed repeatability, portfolio-scoped reads and nonmember denial");

  // All scenario changes below roll back, including the temporary empty portfolio.
  try {
    await db.$transaction(async (tx) => {
      const rows = await tx.membership.findMany({ where: { portfolioId: "demo-primary" } });
      assert.deepEqual(new Set(rows.map((row) => row.role)), new Set(["OWNER", "EDITOR", "VIEWER"]));
      await tx.$executeRawUnsafe("SAVEPOINT price_change");
      await tx.position.update({ where: { id: "demo-stock" }, data: { unitPrice: "60", priceAsOf: seedTime } });
      const updated = await getPortfolioValuation(tx, "demo-owner", "demo-primary");
      assert.equal(updated.totalValue, "700");
      assert.equal(updated.positions.find((position) => position.id === "demo-stock")?.quantity, "10");
      await tx.$executeRawUnsafe("ROLLBACK TO SAVEPOINT price_change");
      await tx.$executeRawUnsafe("RELEASE SAVEPOINT price_change");
      const added = await tx.positionMovement.create({ data: {
        portfolioId: "demo-primary", positionId: "demo-stock", signedQuantity: "2",
        createdBy: "demo-owner", occurredAt: seedTime, requestKey: randomUUID(),
        note: "Temporary phase 2 verification: +2 units, not a purchase",
      } });
      const increased = await getPortfolioValuation(tx, "demo-owner", "demo-primary");
      assert.equal(increased.totalValue, "700");
      assert.equal(increased.positions.find((position) => position.id === "demo-stock")?.quantity, "12");
      assert.equal(increased.positions.find((position) => position.id === "demo-stock")?.unitPrice, "50");
      assert.equal(increased.positions.find((position) => position.id === "demo-cash")?.value, "100");
      const empty = await tx.portfolio.create({ data: { name: "Temporary empty test portfolio" } });
      await tx.membership.create({ data: { userId: "demo-owner", portfolioId: empty.id, role: "OWNER" } });
      assert.equal((await getPortfolioValuation(tx, "demo-owner", empty.id)).totalValue, "0");
      const fraction = await tx.position.create({ data: { portfolioId: empty.id, assetType: "CRYPTO", label: "Fraction test", symbol: "FRACTION", unitPrice: "0.1", priceAsOf: seedTime } });
      for (const signedQuantity of ["0.1", "0.2"]) {
        await tx.positionMovement.create({ data: { portfolioId: empty.id, positionId: fraction.id, signedQuantity, createdBy: "demo-owner", occurredAt: seedTime, requestKey: randomUUID() } });
      }
      assert.equal((await getPortfolioValuation(tx, "demo-owner", empty.id)).totalValue, "0.03");
      const movement = { ...seedMovements[0], id: randomUUID(), requestKey: randomUUID() };
      await expectDatabaseFailure(tx, () => tx.membership.create({ data: { userId: "demo-owner", portfolioId: "demo-primary", role: "VIEWER" } }), /unique/i);
      await expectDatabaseFailure(tx, () => tx.positionMovement.create({ data: { ...movement, requestKey: seedMovements[0].requestKey } }), /unique/i);
      await expectDatabaseFailure(tx, () => tx.positionMovement.create({ data: { ...movement, portfolioId: "demo-secondary" } }), /foreign key/i);
      await expectDatabaseFailure(tx, () => tx.positionMovement.create({ data: { ...movement, signedQuantity: "0" } }), /PositionMovement_nonzero_finite/);
      await expectDatabaseFailure(tx, () => tx.position.update({ where: { id: "demo-stock" }, data: { unitPrice: "-1" } }), /Position_valid_price/);
      await expectDatabaseFailure(tx, () => tx.position.update({ where: { id: "demo-cash" }, data: { unitPrice: "2" } }), /Position_cash_fixed_price/);
      // Probe only a record created in this rolled-back test; never target existing history.
      await expectDatabaseFailure(tx, () => tx.positionMovement.update({ where: { id: added.id }, data: { signedQuantity: "99" } }), /append-only/);
      await expectDatabaseFailure(tx, () => tx.positionMovement.delete({ where: { id: added.id } }), /append-only/);
      const triggers = await tx.$queryRaw<{ tgname: string }[]>`SELECT tgname FROM pg_trigger WHERE tgrelid = 'public."PositionMovement"'::regclass AND NOT tgisinternal AND tgenabled = 'O'`;
      assert.ok(triggers.some((trigger) => trigger.tgname === "PositionMovement_no_truncate"));
      console.log("PASS: price-only and +2-unit 600 -> 700, unchanged cash, fractions, empty portfolio, uniqueness, FK, price checks, append-only protection (TRUNCATE trigger inspected, never executed)");
      throw rollback;
    }, { timeout: 60000 });
  } catch (error) {
    if (error !== rollback) throw error;
  }
  assert.equal((await getPortfolioValuation(db, "demo-owner", "demo-primary")).totalValue, "600");
  assert.equal(await db.positionMovement.count(), countBefore);
  console.log("PASS: verification scenario changes rolled back");
}

let db: PrismaClient | undefined;
try {
  db = createDatabaseClient();
  await verify(db);
} catch (error) {
  const category = error instanceof assert.AssertionError ? "assertion" : error instanceof Error ? error.name : "unknown";
  console.error(`Database verification did not pass (${category}). Check connectivity, migrations and synthetic fixtures; connection secrets are not logged.`);
  process.exitCode = 1;
} finally {
  await db?.$disconnect();
}
