import "server-only";
import { Prisma } from "../../generated/prisma/client";

// Isolated constructor: do not mutate Prisma's global Decimal configuration.
// 80 significant digits exceeds a 28x28-digit product plus practical sum growth.
const Decimal = Prisma.Decimal.clone({ precision: 80, rounding: Prisma.Decimal.ROUND_HALF_UP });
type DecimalInput = string | Prisma.Decimal;

export type ValuationPosition = {
  id: string;
  assetType: "STOCK" | "CRYPTO" | "CASH";
  unitPrice: DecimalInput;
  priceAsOf: Date;
  movements: readonly { signedQuantity: DecimalInput }[];
};

function decimal(input: DecimalInput) {
  // Reject JS numbers even if an untyped caller bypasses the TS boundary.
  if (typeof input !== "string" && !Prisma.Decimal.isDecimal(input)) {
    throw new Error("Use a decimal string or Prisma Decimal, not a JS number.");
  }
  const value = new Decimal(input.toString());
  if (!value.isFinite()) throw new Error("Decimal must be finite.");
  return value;
}

export function calculateValuation(positions: readonly ValuationPosition[]) {
  let total = new Decimal("0");
  const values = positions.map((position) => {
    const price = decimal(position.unitPrice);
    if (price.isNegative() || (position.assetType === "CASH" && !price.equals("1"))) {
      throw new Error("Invalid manual unit price.");
    }
    let quantity = new Decimal("0");
    for (const movement of position.movements) {
      const delta = decimal(movement.signedQuantity);
      if (delta.isZero()) throw new Error("Movement quantity must be nonzero.");
      quantity = quantity.plus(delta);
    }
    if (quantity.isNegative()) throw new Error("Negative position balance is not supported.");
    if (position.assetType === "CASH" && quantity.decimalPlaces() > 2) {
      throw new Error("Cash quantity must have at most two decimal places.");
    }
    const value = quantity.times(price);
    total = total.plus(value);
    return { position, price, quantity, value };
  });

  // Plain decimal strings preserve exact values across serialization boundaries.
  return {
    currency: "USD" as const,
    totalValue: total.toFixed(),
    displayTotal: total.toFixed(2),
    positions: values.map(({ position, price, quantity, value }) => ({
      id: position.id,
      quantity: quantity.toFixed(),
      unitPrice: price.toFixed(),
      priceAsOf: position.priceAsOf.toISOString(),
      value: value.toFixed(),
      allocationPercent: total.isZero() ? "0" : value.dividedBy(total).times("100").toFixed(4),
    })),
  };
}
