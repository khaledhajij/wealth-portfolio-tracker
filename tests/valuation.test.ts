import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateValuation, type ValuationPosition } from "../lib/server/valuation";

const time = new Date("2026-10-24T10:00:00.000Z");
function stock(unitPrice: string, deltas: string[]): ValuationPosition {
  return { id: "stock", assetType: "STOCK", unitPrice, priceAsOf: time, movements: deltas.map((signedQuantity) => ({ signedQuantity })) };
}

test("movement-derived balance values at 600 then 700 after a price change only", () => {
  const cash: ValuationPosition = { ...stock("1", ["100"]), id: "cash", assetType: "CASH" };
  const before = calculateValuation([stock("50", ["12", "-2"]), cash]);
  const after = calculateValuation([stock("60", ["12", "-2"]), cash]);
  assert.equal(before.totalValue, "600");
  assert.equal(after.totalValue, "700");
  assert.equal(before.positions[0].quantity, "10");
  assert.equal(after.positions[0].quantity, "10");
  assert.equal(after.positions[1].value, "100");
  assert.equal(after.positions[0].priceAsOf, time.toISOString());
});

test("adding two units changes 600 to 700 while price and cash remain unchanged", () => {
  const cash: ValuationPosition = { ...stock("1", ["100"]), id: "cash", assetType: "CASH" };
  const before = calculateValuation([stock("50", ["12", "-2"]), cash]);
  const after = calculateValuation([stock("50", ["12", "-2", "2"]), cash]);
  assert.equal(before.totalValue, "600");
  assert.equal(after.totalValue, "700");
  assert.equal(after.positions[0].quantity, "12");
  assert.equal(after.positions[0].unitPrice, "50");
  assert.equal(after.positions[1].value, "100");
});

test("fractional additions and multiplication stay exact", () => {
  const result = calculateValuation([stock("0.1", ["0.1", "0.2"])]);
  assert.equal(result.positions[0].quantity, "0.3");
  assert.equal(result.totalValue, "0.03");
  assert.equal(calculateValuation([stock("0.00000001", ["0.0000000001"])]).totalValue, "0.000000000000000001");
});

test("large decimal products exceed binary float and default Decimal precision safely", () => {
  assert.equal(calculateValuation([stock("10000000000000000001", ["10"])]).totalValue, "100000000000000000010");
});

test("empty portfolio and zero-balance allocation are defined", () => {
  assert.deepEqual(calculateValuation([]), { currency: "USD", totalValue: "0", displayTotal: "0.00", positions: [],
    allocationByAssetType: ["STOCK", "CRYPTO", "CASH"].map((assetType) => ({ assetType, value: "0", allocationPercent: "0" })),
  });
  assert.equal(calculateValuation([stock("50", ["2", "-2"])]).positions[0].allocationPercent, "0");
});

test("allocation groups multiple positions by asset type using the same unrounded total", () => {
  const result = calculateValuation([stock("50", ["10"]), { ...stock("20", ["5"]), id: "stock-two" },
    { ...stock("800", ["0.25"]), id: "crypto", assetType: "CRYPTO" },
    { ...stock("1", ["200"]), id: "cash", assetType: "CASH" }]);
  assert.equal(result.totalValue, "1000");
  assert.deepEqual(result.allocationByAssetType, [
    { assetType: "STOCK", value: "600", allocationPercent: "60.0000" },
    { assetType: "CRYPTO", value: "200", allocationPercent: "20.0000" },
    { assetType: "CASH", value: "200", allocationPercent: "20.0000" },
  ]);
});

test("round USD only after adding unrounded position values, half-up", () => {
  assert.equal(calculateValuation([stock("0.005", ["1"]), { ...stock("0.005", ["1"]), id: "second" }]).displayTotal, "0.01");
  assert.equal(calculateValuation([stock("0.005", ["1"])]).displayTotal, "0.01");
});

test("reject invalid prices, cash rules, zero deltas, negative balances and JS numbers", () => {
  for (const invalid of [stock("-1", ["1"]), stock("NaN", ["1"]), stock("Infinity", ["1"]), stock("1", ["0"]), stock("1", ["-1"]), { ...stock("2", ["1"]), assetType: "CASH" as const }, { ...stock("1", ["0.001"]), assetType: "CASH" as const }, stock(0.1 as unknown as string, ["1"])]) {
    assert.throws(() => calculateValuation([invalid]));
  }
});
