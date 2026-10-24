import "server-only";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { calculateValuation } from "./valuation";
import { movementInput, positionInput, priceInput, resourceId } from "./contracts";
import { ServiceError } from "./service-error";

const Decimal = Prisma.Decimal.clone({ precision: 80 });
type Tx = Prisma.TransactionClient;
type UserReader = () => Promise<{ id: string }>;
const missing = () => new ServiceError(404, "Resource not found.");

async function member(db: Pick<Tx, "membership">, userId: string, portfolioId: string, write = false) {
  const row = await db.membership.findUnique({ where: { userId_portfolioId: { userId, portfolioId } } });
  if (!row || !["OWNER", "EDITOR", "VIEWER"].includes(row.role)) throw missing();
  if (write && row.role !== "OWNER" && row.role !== "EDITOR") throw new ServiceError(403, "Write access required.");
  return row;
}

async function position(db: Pick<Tx, "position">, portfolioId: string, positionId: string) {
  const row = await db.position.findFirst({ where: { id: positionId, portfolioId } });
  if (!row) throw missing();
  return row;
}

function positionDto(row: Awaited<ReturnType<typeof position>>) {
  return { id: row.id, portfolioId: row.portfolioId, assetType: row.assetType, label: row.label, symbol: row.symbol,
    unitPrice: row.unitPrice.toFixed(), priceAsOf: row.priceAsOf.toISOString() };
}

function movementDto(row: { id: string; signedQuantity: Prisma.Decimal; occurredAt: Date; note: string | null }) {
  return { id: row.id, signedQuantity: row.signedQuantity.toFixed(), occurredAt: row.occurredAt.toISOString(), note: row.note };
}

// Factory is a server-internal test seam. Production binds requireUser, never request identity.
export function createPortfolioService(db: PrismaClient, currentUser: UserReader) {
  async function actor() {
    const user = await currentUser();
    if (!user?.id) throw new ServiceError(401, "Sign in required.");
    return user.id;
  }
  async function write<T>(userId: string, portfolioId: string, operation: (tx: Tx) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await db.$transaction(async (tx) => {
          // Lock existing membership so a future revocation cannot race this write.
          await tx.$queryRaw`SELECT id FROM "Membership" WHERE "userId" = ${userId} AND "portfolioId" = ${portfolioId} FOR SHARE`;
          await member(tx, userId, portfolioId, true);
          return operation(tx);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
      } catch (error) {
        const code = error instanceof Prisma.PrismaClientKnownRequestError ? error.code : undefined;
        if (code === "P2034" && attempt < 2) continue;
        if (code === "P2002") throw new ServiceError(409, "A position or request key already exists.");
        if (code === "P2034") throw new ServiceError(409, "Concurrent change; retry the operation.");
        throw error;
      }
    }
    throw new ServiceError(409, "Retry the operation.");
  }
  async function lockPosition(tx: Tx, portfolioId: string, positionId: string) {
    await tx.$queryRaw`SELECT id FROM "Position" WHERE id = ${positionId} AND "portfolioId" = ${portfolioId} FOR UPDATE`;
    return position(tx, portfolioId, positionId);
  }
  return {
    async listPortfolios() {
      const userId = await actor();
      const rows = await db.membership.findMany({ where: { userId, role: { in: ["OWNER", "EDITOR", "VIEWER"] } },
        select: { role: true, portfolio: { select: { id: true, name: true, currency: true } } }, orderBy: { portfolioId: "asc" } });
      return rows.map((row) => ({ ...row.portfolio, role: row.role }));
    },
    async getPortfolio(portfolioId: string) {
      const userId = await actor();
      resourceId.parse(portfolioId);
      // Membership and nested resources read together; no shared result cache.
      const row = await db.membership.findUnique({ where: { userId_portfolioId: { userId, portfolioId } },
        select: { role: true, portfolio: { select: { id: true, name: true, positions: {
          orderBy: { id: "asc" }, include: { movements: { select: { signedQuantity: true } } },
        } } } } });
      if (!row || !["OWNER", "EDITOR", "VIEWER"].includes(row.role)) throw missing();
      return { id: row.portfolio.id, name: row.portfolio.name, role: row.role,
        positions: row.portfolio.positions.map(positionDto), valuation: calculateValuation(row.portfolio.positions) };
    },
    async getPosition(portfolioId: string, positionId: string) {
      const userId = await actor();
      resourceId.parse(portfolioId); resourceId.parse(positionId);
      await member(db, userId, portfolioId);
      return positionDto(await position(db, portfolioId, positionId));
    },
    async listMovements(portfolioId: string, positionId: string) {
      const userId = await actor();
      resourceId.parse(portfolioId); resourceId.parse(positionId);
      await member(db, userId, portfolioId);
      await position(db, portfolioId, positionId);
      const rows = await db.positionMovement.findMany({ where: { portfolioId, positionId },
        orderBy: [{ occurredAt: "desc" }, { id: "desc" }], take: 100 });
      return rows.map(movementDto);
    },
    async addPosition(portfolioId: string, input: unknown) {
      const userId = await actor();
      resourceId.parse(portfolioId);
      return write(userId, portfolioId, async (tx) => {
        const data = positionInput.parse(input);
        if (data.assetType === "CASH" && (data.symbol !== "USD" || !new Decimal(data.unitPrice).eq(1))) {
          throw new ServiceError(400, "Cash requires symbol USD and unit price 1.");
        }
        const row = await tx.position.create({ data: { ...data, portfolioId, priceUpdatedBy: userId, priceAsOf: new Date(data.priceAsOf) } });
        return positionDto(row);
      });
    },
    async recordMovement(portfolioId: string, positionId: string, input: unknown) {
      const userId = await actor();
      resourceId.parse(portfolioId); resourceId.parse(positionId);
      return write(userId, portfolioId, async (tx) => {
        const row = await lockPosition(tx, portfolioId, positionId);
        const data = movementInput.parse(input);
        const delta = new Decimal(data.signedQuantity);
        if (row.assetType === "CASH" && delta.decimalPlaces() > 2) throw new ServiceError(400, "Cash accepts cents only.");
        const existing = await tx.positionMovement.findUnique({ where: { requestKey: data.requestKey } });
        if (existing) {
          if (existing.portfolioId !== portfolioId || existing.positionId !== positionId || existing.createdBy !== userId ||
              !existing.signedQuantity.eq(data.signedQuantity) || existing.occurredAt.getTime() !== Date.parse(data.occurredAt) ||
              existing.note !== (data.note ?? null)) throw new ServiceError(409, "Request key conflicts with another operation.");
          return movementDto(existing);
        }
        const total = await tx.positionMovement.aggregate({ where: { portfolioId, positionId }, _sum: { signedQuantity: true } });
        const balance = new Decimal(total._sum.signedQuantity?.toString() ?? "0").plus(delta);
        if (balance.isNegative()) throw new ServiceError(400, "Resulting quantity cannot be negative.");
        // Bound aggregates as well as individual numeric columns.
        if (balance.gte("1000000000000000000")) throw new ServiceError(400, "Resulting quantity is too large.");
        const movement = await tx.positionMovement.create({ data: { ...data, portfolioId, positionId, createdBy: userId, occurredAt: new Date(data.occurredAt) } });
        return movementDto(movement);
      });
    },
    async updatePrice(portfolioId: string, positionId: string, input: unknown) {
      const userId = await actor();
      resourceId.parse(portfolioId); resourceId.parse(positionId);
      return write(userId, portfolioId, async (tx) => {
        const row = await lockPosition(tx, portfolioId, positionId);
        const data = priceInput.parse(input);
        if (row.assetType === "CASH" && !new Decimal(data.unitPrice).eq(1)) throw new ServiceError(400, "Cash unit price is fixed at 1.");
        return positionDto(await tx.position.update({ where: { id_portfolioId: { id: positionId, portfolioId } },
          data: { ...data, priceAsOf: new Date(data.priceAsOf), priceUpdatedBy: userId } }));
      });
    },
  };
}
