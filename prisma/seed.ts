import nextEnv from "@next/env";
import { Prisma, type PrismaClient } from "../generated/prisma/client";
import { createDatabaseClient } from "../lib/server/db";
import { seedUsers, seedPortfolios, seedMemberships, seedPositions, seedMovements } from "./seed-data";

export async function seedDatabase(db: PrismaClient) {
  // Insert missing fixtures only. Never reset user changes or UPDATE immutable history.
  await db.$transaction(async (tx) => {
    for (const user of seedUsers) {
      await tx.user.upsert({ where: { id: user.id }, create: user, update: {} });
    }
    for (const portfolio of seedPortfolios) {
      await tx.portfolio.upsert({ where: { id: portfolio.id }, create: portfolio, update: {} });
    }
    for (const membership of seedMemberships) {
      await tx.membership.upsert({ where: { userId_portfolioId: { userId: membership.userId, portfolioId: membership.portfolioId } }, create: membership, update: {} });
    }
    for (const position of seedPositions) {
      await tx.position.upsert({ where: { id: position.id }, create: position, update: {} });
    }
    for (const movement of seedMovements) {
      const existing = await tx.positionMovement.findUnique({ where: { requestKey: movement.requestKey } });
      if (!existing) {
        await tx.positionMovement.create({ data: movement });
      } else if (
        existing.id !== movement.id || existing.positionId !== movement.positionId ||
        existing.portfolioId !== movement.portfolioId || existing.createdBy !== movement.createdBy ||
        !existing.signedQuantity.equals(new Prisma.Decimal(movement.signedQuantity)) ||
        existing.occurredAt.getTime() !== movement.occurredAt.getTime() || existing.note !== movement.note
      ) {
        throw new Error("Seed requestKey conflicts with different movement content; no data was changed.");
      }
    }
  }, { timeout: 30000 });
}

// Keep importing seedDatabase in verification scripts free of side effects.
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/prisma/seed.ts")) {
  nextEnv.loadEnvConfig(process.cwd());
  let db: PrismaClient | undefined;
  try {
    db = createDatabaseClient();
    await seedDatabase(db);
    console.log("Synthetic seed complete; existing rows preserved. Accounts cannot sign in.");
  } catch {
    console.error("Seed failed. Check DATABASE_URL, migration status, and fixture conflicts. No URL logged.");
    process.exitCode = 1;
  } finally {
    await db?.$disconnect();
  }
}
