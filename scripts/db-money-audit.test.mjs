import assert from "node:assert/strict";
import test from "node:test";
import { auditClpMoneyRecords, isWholeMoney } from "./db-money-audit-core.mjs";

test("accepts whole CLP values even when PostgreSQL renders scale zeroes", () => {
  assert.equal(isWholeMoney("1000"), true);
  assert.equal(isWholeMoney("1000.00"), true);
  assert.equal(isWholeMoney("1000.50"), false);
});

test("reports only table, identifier and field for fractional records", () => {
  const findings = auditClpMoneyRecords([{
    table: "Payment",
    records: [{ id: "payment-1", amount: "1000.50" }],
    fields: [{ name: "amount", value: (record) => record.amount }]
  }]);
  assert.deepEqual(findings, [{ table: "Payment", id: "payment-1", field: "amount" }]);
});
