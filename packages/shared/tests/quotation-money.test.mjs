import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQuotationMoney,
  currencyFractionDigits,
  currencyStep,
  formatMoney,
  moneyToMinorUnits,
  parseMoney,
  validateMoneyPrecision
} from "../dist/index.js";

test("calculates exact totals without floating point drift", () => {
  const result = calculateQuotationMoney([
    { quantity: "3", unitPrice: "33.33", discountType: "NONE", discountValue: "0", taxPercent: "19" }
  ]);

  assert.equal(result.subtotal, "99.99");
  assert.equal(result.discountTotal, "0.00");
  assert.equal(result.taxTotal, "19.00");
  assert.equal(result.total, "118.99");
  assert.deepEqual(result.lines[0], {
    subtotal: "99.99",
    lineDiscountTotal: "0.00",
    globalDiscountTotal: "0.00",
    discountTotal: "0.00",
    taxableBase: "99.99",
    taxTotal: "19.00",
    total: "118.99"
  });
});

test("applies zero-decimal CLP precision and deterministic peso residuals", () => {
  const result = calculateQuotationMoney(
    [
      { quantity: "1", unitPrice: "1", discountType: "NONE", discountValue: "0", taxPercent: "0" },
      { quantity: "1", unitPrice: "1", discountType: "NONE", discountValue: "0", taxPercent: "0" },
      { quantity: "1", unitPrice: "1", discountType: "NONE", discountValue: "0", taxPercent: "0" }
    ],
    "50",
    { currency: "CLP" }
  );

  assert.equal(result.subtotal, "3");
  assert.equal(result.globalDiscountTotal, "2");
  assert.deepEqual(result.lines.map((line) => line.globalDiscountTotal), ["1", "1", "0"]);
  assert.equal(result.total, "1");
});

test("centralizes currency precision, parsing, formatting and minor units", () => {
  assert.equal(currencyFractionDigits("CLP"), 0);
  assert.equal(currencyFractionDigits("USD"), 2);
  assert.equal(currencyStep("CLP"), "1");
  assert.equal(currencyStep("BRL"), "0.01");
  assert.equal(validateMoneyPrecision("1000.00", "CLP"), true);
  assert.equal(validateMoneyPrecision("1000.50", "CLP"), false);
  assert.equal(parseMoney("001000.00", "CLP"), "1000");
  assert.equal(parseMoney("10.5", "USD"), "10.50");
  assert.equal(moneyToMinorUnits("1000", "CLP"), "1000");
  assert.equal(moneyToMinorUnits("10.50", "USD"), "1050");
  assert.equal(formatMoney("59500", "CLP", "es-CL"), "$59.500");
});

test("rejects fractional CLP money instead of rounding silently", () => {
  const fractional = [
    { quantity: "1", unitPrice: "1000.50", discountType: "NONE", discountValue: "0", taxPercent: "19" }
  ];
  assert.throws(
    () => calculateQuotationMoney(fractional, "0", { currency: "CLP" }),
    /invalid precision for CLP/
  );
  assert.throws(() => parseMoney("1000.50", "CLP"), { code: "CLP_FRACTION_NOT_ALLOWED" });
});

test("applies global discounts only to eligible lines", () => {
  const result = calculateQuotationMoney(
    [
      { quantity: "1", unitPrice: "1000", discountType: "NONE", discountValue: "0", taxPercent: "19" },
      { quantity: "1", unitPrice: "1000", discountType: "PERCENTAGE", discountValue: "10", taxPercent: "19" },
      { quantity: "1", unitPrice: "1000", discountType: "FIXED", discountValue: "50", taxPercent: "0" }
    ],
    "5"
  );

  assert.equal(result.subtotal, "3000.00");
  assert.equal(result.lineDiscountTotal, "150.00");
  assert.equal(result.globalDiscountTotal, "50.00");
  assert.equal(result.discountTotal, "200.00");
  assert.equal(result.taxTotal, "351.50");
  assert.equal(result.total, "3151.50");
});

test("distributes residual minor units deterministically", () => {
  const result = calculateQuotationMoney(
    [
      { quantity: 1, unitPrice: "0.01", discountType: "NONE", discountValue: 0, taxPercent: 0 },
      { quantity: 1, unitPrice: "0.01", discountType: "NONE", discountValue: 0, taxPercent: 0 },
      { quantity: 1, unitPrice: "0.01", discountType: "NONE", discountValue: 0, taxPercent: 0 }
    ],
    "50"
  );

  assert.equal(result.globalDiscountTotal, "0.02");
  assert.deepEqual(result.lines.map((line) => line.globalDiscountTotal), ["0.01", "0.01", "0.00"]);
  assert.equal(result.total, "0.01");
});

test("supports zero, five and one hundred percent global discounts", () => {
  const line = [{ quantity: "2", unitPrice: "250", discountType: "NONE", discountValue: 0, taxPercent: "19" }];
  assert.equal(calculateQuotationMoney(line, "0").total, "595.00");
  assert.equal(calculateQuotationMoney(line, "5").discountTotal, "25.00");
  assert.equal(calculateQuotationMoney(line, "100").total, "0.00");
});

test("rejects invalid global and line discounts", () => {
  const line = [{ quantity: "1", unitPrice: "100", discountType: "NONE", discountValue: 0, taxPercent: "0" }];
  assert.throws(() => calculateQuotationMoney(line, "-0.01"), RangeError);
  assert.throws(() => calculateQuotationMoney(line, "100.01"), RangeError);
  assert.throws(
    () => calculateQuotationMoney([{ ...line[0], discountValue: 1 }]),
    /must be zero/
  );
  assert.throws(
    () => calculateQuotationMoney([{ ...line[0], discountType: "PERCENTAGE", discountValue: 100.01 }]),
    RangeError
  );
  assert.throws(
    () => calculateQuotationMoney([{ ...line[0], discountType: "FIXED", discountValue: 100.01 }]),
    RangeError
  );
});

test("handles fixed, percentage, taxable and exempt lines", () => {
  const result = calculateQuotationMoney(
    [
      { quantity: "1", unitPrice: "100", discountType: "FIXED", discountValue: "20", taxPercent: "19" },
      { quantity: "2", unitPrice: "75", discountType: "PERCENTAGE", discountValue: "10", taxPercent: "0" }
    ],
    "5"
  );

  assert.equal(result.discountTotal, "35.00");
  assert.equal(result.taxTotal, "15.20");
  assert.equal(result.total, "230.20");
});
