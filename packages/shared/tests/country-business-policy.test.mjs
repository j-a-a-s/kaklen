import assert from "node:assert/strict";
import test from "node:test";
import {
  countryBusinessPolicy,
  isValidCountryPhone,
  normalizeCountryCode,
  normalizeInternationalPhone
} from "../dist/country-business-policy.js";

test("uses Chile as the safe default policy", () => {
  assert.equal(normalizeCountryCode(undefined), "CL");
  assert.equal(normalizeCountryCode("unknown"), "CL");
  assert.deepEqual(
    {
      taxIdRequired: countryBusinessPolicy("CL").taxIdRequired,
      whatsappRequired: countryBusinessPolicy("CL").whatsappRequired,
      currency: countryBusinessPolicy("CL").defaultCurrency,
      tax: countryBusinessPolicy("CL").defaultTaxPercent,
      locale: countryBusinessPolicy("CL").regionalLocale
    },
    { taxIdRequired: true, whatsappRequired: true, currency: "CLP", tax: 19, locale: "es-CL" }
  );
});

test("normalizes and validates country phones", () => {
  assert.equal(normalizeInternationalPhone("+56 9 1234 5678"), "+56912345678");
  assert.equal(normalizeInternationalPhone("56 9 1234 5678"), "");
  assert.equal(isValidCountryPhone("+56 9 1234 5678", "CL"), true);
  assert.equal(isValidCountryPhone("+56 ABC", "CL"), false);
});
