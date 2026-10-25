import assert from "node:assert/strict";
import test from "node:test";
import { decimalText, usd, utcTime } from "../lib/portfolio-display";

test("English formatting preserves large and fractional decimal strings without Number coercion", () => {
  assert.equal(usd("100000000000000000010"), "$100,000,000,000,000,000,010.00");
  assert.equal(usd("0.000000000000000001"), "$0.000000000000000001");
  assert.equal(decimalText("-1234.1234567890"), "-1,234.1234567890");
  assert.equal(usd("600.00"), "$600.00");
  assert.throws(() => usd("NaN"));
});
test("timestamps are displayed with an explicit UTC timezone", () => {
  assert.equal(
    utcTime("2026-10-24T10:00:00.000Z"),
    utcTime("2026-10-24T12:00:00.000+02:00"),
  );
  assert.match(utcTime("2026-10-24T10:00:00.000Z"), /UTC$/);
});
