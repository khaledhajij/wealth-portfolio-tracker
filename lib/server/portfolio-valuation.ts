import "server-only";
import type { PrismaClient } from "../../generated/prisma/client";
import { calculateValuation } from "./valuation";

// Internal only. Phase 3 must supply actorId from a trusted session, never a request.
// Keeping the membership and nested portfolio read together avoids a global data read.
export async function getPortfolioValuation(db: Pick<PrismaClient, "membership">, actorId: string, portfolioId: string) {
  const membership = await db.membership.findUnique({
    where: { userId_portfolioId: { userId: actorId, portfolioId } },
    select: {
      portfolio: {
        select: {
          positions: {
            orderBy: { id: "asc" },
            select: {
              id: true,
              assetType: true,
              unitPrice: true,
              priceAsOf: true,
              movements: { select: { signedQuantity: true } },
            },
          },
        },
      },
    },
  });
  if (!membership) throw new Error("Portfolio not found or inaccessible.");
  return calculateValuation(membership.portfolio.positions);
}
