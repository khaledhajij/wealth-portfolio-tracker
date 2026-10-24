// Phase 2 database fixture helper only. Production uses session-bound services.
import type { PrismaClient } from "../generated/prisma/client";
import { calculateValuation } from "../lib/server/valuation";

export async function getPortfolioValuation(db: Pick<PrismaClient, "membership">, actorId: string, portfolioId: string) {
  const row = await db.membership.findUnique({ where: { userId_portfolioId: { userId: actorId, portfolioId } },
    select: { portfolio: { select: { positions: { include: { movements: { select: { signedQuantity: true } } } } } } } });
  if (!row) throw new Error("Portfolio not found or inaccessible.");
  return calculateValuation(row.portfolio.positions);
}
