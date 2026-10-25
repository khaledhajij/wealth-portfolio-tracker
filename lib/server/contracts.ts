import "server-only";
import { z } from "zod";

export const resourceId = z.string().min(1).max(128).regex(/^\S+$/, "Resource ID must not contain whitespace.");
// No existing portfolio-name limit: use 100 characters for this prototype.
export const portfolioInput = z.strictObject({ name: z.string().trim().min(1).max(100) });
const timestamp = z.iso.datetime({ offset: true })
  .refine((value) => !/\.\d{4,}/.test(value), "Use at most millisecond timestamp precision.")
  .refine((value) => Date.parse(value) <= Date.now(), "Timestamp must not be in the future.");
// Reject extra input scale before PostgreSQL can round it. No numbers/exponents.
const price = z.string().regex(/^\d{1,20}(\.\d{1,8})?$/, "Use a nonnegative decimal string with at most 8 fractional digits.");
const quantity = z.string().regex(/^-?\d{1,18}(\.\d{1,10})?$/, "Use a signed decimal string with at most 10 fractional digits.")
  .refine((value) => /[1-9]/.test(value), "Quantity must be nonzero.");
export const positionInput = z.strictObject({
  assetType: z.enum(["STOCK", "CRYPTO", "CASH"]),
  label: z.string().trim().min(1).max(160),
  symbol: z.string().trim().min(1).max(32).transform((value) => value.toUpperCase()).pipe(z.string().max(32)),
  unitPrice: price,
  priceAsOf: timestamp,
});
export const movementInput = z.strictObject({
  signedQuantity: quantity,
  occurredAt: timestamp,
  requestKey: z.string().trim().min(1).max(128),
  note: z.string().trim().max(500).optional(),
});
export const priceInput = z.strictObject({ unitPrice: price, priceAsOf: timestamp });
