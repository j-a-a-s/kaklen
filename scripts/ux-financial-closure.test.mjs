import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync("apps/web/src/styles.css", "utf8");
const designSystem = readFileSync("apps/web/src/design-system.css", "utf8");
const quotationForm = readFileSync("apps/web/src/app/pages/quotation-form.component.ts", "utf8");
const quotationDetail = readFileSync("apps/web/src/app/pages/quotation-detail.component.ts", "utf8");
const publicQuotation = readFileSync("apps/web/src/app/pages/public-quotation.component.ts", "utf8");
const quotationList = readFileSync("apps/web/src/app/pages/quotation-list.component.ts", "utf8");
const quotationDocument = readFileSync("apps/api/src/quotations/quotation-document.service.ts", "utf8");

test("shared form grid contains controls and collapses to one mobile column", () => {
  assert.match(
    styles,
    /\.field-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)[^}]*\}/s
  );
  assert.match(styles, /\.field-grid\s*>\s*\*\s*\{[^}]*min-width:\s*0/s);
  assert.match(
    styles,
    /@media\s*\(max-width:\s*768px\)[\s\S]*?\.field-grid\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)/
  );
  assert.match(
    designSystem,
    /\.form-field\s+:where\(input,\s*select,\s*textarea\)[\s\S]*?box-sizing:\s*border-box;[\s\S]*?width:\s*100%;[\s\S]*?max-width:\s*100%;[\s\S]*?min-width:\s*0;/
  );
});

test("quotation surfaces expose every financial reconciliation label without negative zero markup", () => {
  const labels = [
    "Subtotal neto",
    "Descuento por línea",
    "Descuento global asignado",
    "Descuento total",
    "Base imponible",
    "IVA",
    "Total línea, IVA incluido"
  ];
  for (const surface of [quotationForm, quotationDetail, publicQuotation]) {
    for (const label of labels) {
      assert.match(surface, new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`));
    }
    for (const field of ["subtotal", "lineDiscountTotal", "globalDiscountTotal", "discountTotal", "taxableBase", "taxTotal", "total"]) {
      assert.match(surface, new RegExp(`amounts\\.${field}|item\\.${field}`));
    }
  }
  assert.doesNotMatch(quotationForm, />-\{\{\s*moneyLabel\(/);
  assert.match(designSystem, /\.quotation-line-financial\s*\{[^}]*grid-template-columns:/s);
  assert.match(designSystem, /\.quotation-line-financial\s+\.line-total\s*\{/);
  for (const field of ["subtotal", "lineDiscount", "globalDiscount", "discountTotal", "taxableBase", "tax", "total"]) {
    assert.match(quotationDocument, new RegExp(`item\\.${field}`));
  }
});

test("seller feedback remains escaped, deep-linked, and visibly actionable", () => {
  assert.match(quotationDetail, /id="change-requests"/);
  assert.match(quotationDetail, /\{\{ request\.comment \}\}/);
  assert.doesNotMatch(quotationDetail, /\[innerHTML\]/);
  assert.match(quotationDetail, /Crear nueva versión/);
  assert.match(quotationDetail, /Sin ítems específicos/);
  assert.match(quotationDetail, /requestAnimationFrame/);
  assert.match(designSystem, /\.change-requests-highlighted\s*\{/);
  assert.match(designSystem, /\.change-request p,[\s\S]*?white-space:\s*pre-wrap;[\s\S]*?overflow-wrap:\s*anywhere;/);
});

test("approved quotation KPIs consume isolated currency groups", () => {
  assert.match(quotationList, /baseCurrencyApprovedAmount/);
  assert.match(quotationList, /approvedAmounts\.filter/);
  assert.match(quotationList, /Aprobado en moneda base/);
  assert.match(quotationList, /Otros importes aprobados/);
  assert.doesNotMatch(quotationList, /baseCurrencyAmountApproved|amountApprovedByCurrency/);
});
