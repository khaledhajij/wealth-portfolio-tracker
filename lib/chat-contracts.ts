import { z } from "zod";

export const CHAT_LIMITS = {
  questionCharacters: 2000,
  steps: 3,
  outputTokensPerStep: 600,
  toolCalls: 4,
  positions: 10,
  durationMs: 30000,
} as const;
export const chatInput = z.strictObject({
  portfolioId: z.string().min(1).max(128).regex(/^\S+$/),
  message: z.string().trim().min(1).max(CHAT_LIMITS.questionCharacters),
});
// The model has no portfolio/user/role/filter argument to override.
export const readToolInput = z.strictObject({});
const decimal = z
  .string()
  .regex(/^\d+(\.\d+)?$/)
  .max(160);
const timestamp = z.iso.datetime();
export const summaryOutput = z.strictObject({
  currency: z.literal("USD"),
  totalValue: decimal,
  displayTotal: decimal,
  positionCount: z.number().int().nonnegative(),
  manualPriceWindow: z.strictObject({
    oldest: timestamp.nullable(),
    newest: timestamp.nullable(),
  }),
  allocationByAssetType: z
    .array(
      z.strictObject({
        assetType: z.enum(["STOCK", "CRYPTO", "CASH"]),
        value: decimal,
        allocationPercent: decimal,
      }),
    )
    .length(3),
});
export const positionsOutput = z.strictObject({
  currency: z.literal("USD"),
  hasMore: z.boolean(),
  positions: z
    .array(
      z.strictObject({
        assetType: z.enum(["STOCK", "CRYPTO", "CASH"]),
        label: z.string().max(160),
        symbol: z.string().max(32),
        quantity: decimal,
        unitPrice: decimal,
        value: decimal,
        priceAsOf: timestamp,
      }),
    )
    .max(CHAT_LIMITS.positions),
});

export type SummaryOutput = z.infer<typeof summaryOutput>;
export type PositionsOutput = z.infer<typeof positionsOutput>;
