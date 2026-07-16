import assert from "node:assert/strict";
import test from "node:test";
import { calculateQuotationMoney } from "../dist/quotation-money.js";

test("calculates exact totals without floating point drift", () => {
  const result = calculateQuotationMoney([
    { quantity: "3", unitPrice: "33.333", discountType: "NONE", discountValue: "0", taxPercent: "19" }
  ]);

  assert.deepEqual(result, {
    subtotal: "99.99",
    discountTotal: "0.00",
    taxableBase: "99.99",
    taxTotal: "19.00",
    total: "118.99",
    lines: [{ subtotal: "99.99", discountTotal: "0.00", taxableBase: "99.99", taxTotal: "19.00", total: "118.99" }]
  });
});

test("applies the global discount only to lines without a specific discount", () => {
  const result = calculateQuotationMoney([
    { quantity: "1", unitPrice: "1000", discountType: "NONE", discountValue: "0", taxPercent: "19" },
    { quantity: "1", unitPrice: "1000", discountType: "PERCENTAGE", discountValue: "10", taxPercent: "19" },
    { quantity: "1", unitPrice: "1000", discountType: "FIXED", discountValue: "50", taxPercent: "0" }
  ], "5");

  assert.equal(result.subtotal, "3000.00");
  assert.equal(result.discountTotal, "200.00");
  assert.equal(result.taxableBase, "2800.00");
  assert.equal(result.taxTotal, "351.50");
  assert.equal(result.total, "3151.50");
});

test("supports zero and one hundred percent global discounts", () => {
  const line = [{ quantity: "2", unitPrice: "250", discountType: "NONE", taxPercent: "19" }];
  assert.equal(calculateQuotationMoney(line, "0").total, "595.00");
  assert.equal(calculateQuotationMoney(line, "100").total, "0.00");
});

test("rejects negative and over-one-hundred global discounts", () => {
  const line = [{ quantity: "1", unitPrice: "100", discountType: "NONE", taxPercent: "0" }];
  assert.throws(() => calculateQuotationMoney(line, "-0.01"), RangeError);
  assert.throws(() => calculateQuotationMoney(line, "100.01"), RangeError);
});

test("caps fixed discounts at the line subtotal and handles exempt lines", () => {
  const result = calculateQuotationMoney([
    { quantity: "1", unitPrice: "50", discountType: "FIXED", discountValue: "80", taxPercent: "19" },
    { quantity: "2", unitPrice: "75", discountType: "NONE", taxPercent: "0" }
  ], "5");

  assert.equal(result.discountTotal, "57.50");
  assert.equal(result.taxTotal, "0.00");
  assert.equal(result.total, "142.50");
});
