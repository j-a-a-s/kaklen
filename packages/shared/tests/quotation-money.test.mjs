import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateQuotationMoney,
  assertQuotationMoneyInvariants,
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
  assert.equal(parseMoney("-0", "CLP"), "0");
  assert.equal(parseMoney("-0.00", "USD"), "0.00");
  assert.equal(moneyToMinorUnits("1000", "CLP"), "1000");
  assert.equal(moneyToMinorUnits("10.50", "USD"), "1050");
  assert.equal(formatMoney("59500", "CLP", "es-CL"), "$59.500");
  assert.equal(formatMoney("-0", "CLP", "es-CL"), "$0");
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

const clpFixture = [
  { quantity: "2", unitPrice: "210000", discountType: "NONE", discountValue: "0", taxPercent: "19" },
  { quantity: "1", unitPrice: "520000", discountType: "NONE", discountValue: "0", taxPercent: "19" },
  { quantity: "19", unitPrice: "24900", discountType: "NONE", discountValue: "0", taxPercent: "19" }
];

test("reconciles the exact CLP fixture without discounts", () => {
  const result = calculateQuotationMoney(clpFixture, "0", { currency: "CLP" });

  assert.deepEqual(
    {
      subtotal: result.subtotal,
      lineDiscountTotal: result.lineDiscountTotal,
      globalDiscountTotal: result.globalDiscountTotal,
      taxTotal: result.taxTotal,
      total: result.total,
      lineTotals: result.lines.map((line) => line.total)
    },
    {
      subtotal: "1413100",
      lineDiscountTotal: "0",
      globalDiscountTotal: "0",
      taxTotal: "268489",
      total: "1681589",
      lineTotals: ["499800", "618800", "562989"]
    }
  );
});

test("distributes a one percent global discount across every CLP line", () => {
  const result = calculateQuotationMoney(clpFixture, "1", { currency: "CLP" });

  assert.deepEqual(
    {
      globalDiscountTotal: result.globalDiscountTotal,
      taxableBase: result.taxableBase,
      taxTotal: result.taxTotal,
      total: result.total,
      lineTaxes: result.lines.map((line) => line.taxTotal),
      lineTotals: result.lines.map((line) => line.total)
    },
    {
      globalDiscountTotal: "14131",
      taxableBase: "1398969",
      taxTotal: "265804",
      total: "1664773",
      lineTaxes: ["79002", "97812", "88990"],
      lineTotals: ["494802", "612612", "557359"]
    }
  );
});

test("applies global discount after a line discount and preserves exact CLP identities", () => {
  const lines = clpFixture.map((line, index) => index === 1
    ? { ...line, discountType: "PERCENTAGE", discountValue: "5" }
    : line);
  const result = calculateQuotationMoney(lines, "1", { currency: "CLP" });

  assert.deepEqual(
    {
      lineDiscountTotal: result.lineDiscountTotal,
      globalDiscountTotal: result.globalDiscountTotal,
      discountTotal: result.discountTotal,
      taxableBase: result.taxableBase,
      taxTotal: result.taxTotal,
      total: result.total,
      lineTaxes: result.lines.map((line) => line.taxTotal),
      lineTotals: result.lines.map((line) => line.total)
    },
    {
      lineDiscountTotal: "26000",
      globalDiscountTotal: "13871",
      discountTotal: "39871",
      taxableBase: "1373229",
      taxTotal: "260913",
      total: "1634142",
      lineTaxes: ["79002", "92921", "88990"],
      lineTotals: ["494802", "581981", "557359"]
    }
  );
});

test("keeps zero-value line discounts eligible for the global discount", () => {
  const result = calculateQuotationMoney(
    [
      { quantity: "1", unitPrice: "1000", discountType: "PERCENTAGE", discountValue: "0", taxPercent: "0" },
      { quantity: "1", unitPrice: "1000", discountType: "FIXED", discountValue: "0", taxPercent: "0" }
    ],
    "10",
    { currency: "CLP" }
  );

  assert.equal(result.globalDiscountTotal, "200");
  assert.deepEqual(result.lines.map((line) => line.globalDiscountTotal), ["100", "100"]);
});

test("rejects a quotation result that violates a money identity", () => {
  const result = calculateQuotationMoney(clpFixture, "1", { currency: "CLP" });
  const invalid = { ...result, total: "1664774" };

  assert.throws(
    () => assertQuotationMoneyInvariants(invalid, { currency: "CLP" }),
    /invariant failed for total/
  );
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

  assert.equal(result.lineDiscountTotal, "35.00");
  assert.equal(result.globalDiscountTotal, "10.75");
  assert.equal(result.discountTotal, "45.75");
  assert.equal(result.taxTotal, "14.44");
  assert.equal(result.total, "218.69");
});
