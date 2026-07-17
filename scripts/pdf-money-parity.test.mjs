import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { containsFractionalClpDisplay, verifyPdfMoneySource } from "./pdf-money-parity-core.mjs";

const file = "apps/api/src/quotations/quotation-document.service.ts";
const source = readFileSync(file, "utf8");

test("PDF ViewModel uses the exact shared calculation", () => {
  assert.deepEqual(verifyPdfMoneySource(file, source), []);
});

test("PDF parity rejects native number conversion and rounding", () => {
  const changed = source.replace(
    "total: money(calculated.total)",
    "total: money(Number(calculated.total).toFixed(2))"
  );
  const findings = verifyPdfMoneySource(file, changed).join("\n");
  assert.match(findings, /forbidden Number conversion/);
  assert.match(findings, /forbidden toFixed rounding/);
});

test("PDF parity rejects manual monetary arithmetic", () => {
  const changed = source.replace(
    "const organization = source.organization;",
    "const drift = calculated.total - source.total;\n    const organization = source.organization;"
  );
  assert.match(verifyPdfMoneySource(file, changed).join("\n"), /manual monetary arithmetic/);
});

test("PDF parity rejects missing persistence validation", () => {
  const changed = source.replace("this.assertPersistenceParity(source, calculated);", "");
  assert.match(verifyPdfMoneySource(file, changed).join("\n"), /persisted totals are not validated/);
});

test("PDF parity detects visible CLP decimal variants", () => {
  assert.equal(containsFractionalClpDisplay("Total $ 10.000,00"), true);
  assert.equal(containsFractionalClpDisplay("Total $10,000.00"), true);
  assert.equal(containsFractionalClpDisplay("Total 10000.00 CLP"), true);
  assert.equal(containsFractionalClpDisplay("Total $10.000"), false);
});
