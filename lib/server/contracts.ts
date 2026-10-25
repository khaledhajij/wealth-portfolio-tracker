import "server-only";
import { z } from "zod";

export const resourceId = z
  .string()
  .min(1)
  .max(128)
  .regex(/^\S+$/, "Resource ID must not contain whitespace.");
// Portfolio names are limited to 100 characters.
export const portfolioInput = z.strictObject({
  name: z.string().trim().min(1).max(100),
});
// Reject extra input scale before PostgreSQL can round it. No numbers/exponents.
const price = z
  .string()
  .regex(
    /^\d{1,20}(\.\d{1,8})?$/,
    "Use a nonnegative decimal string with at most 8 fractional digits.",
  );
const quantity = z
  .string()
  .regex(
    /^-?\d{1,18}(\.\d{1,10})?$/,
    "Use a signed decimal string with at most 10 fractional digits.",
  )
  .refine((value) => /[1-9]/.test(value), "Quantity must be nonzero.");
export const positionInput = z.strictObject({
  assetType: z.enum(["STOCK", "CRYPTO", "CASH"]),
  label: z.string().trim().min(1).max(160),
  symbol: z
    .string()
    .trim()
    .min(1)
    .max(32)
    .transform((value) => value.toUpperCase())
    .pipe(z.string().max(32)),
  unitPrice: price,
});
export const movementInput = z.strictObject({
  signedQuantity: quantity,
  requestKey: z.string().trim().min(1).max(128),
  note: z.string().trim().max(500).optional(),
});
export const priceInput = z.strictObject({ unitPrice: price });
