import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const styles = readFileSync("apps/web/src/styles.css", "utf8");
const designSystem = readFileSync("apps/web/src/design-system.css", "utf8");
const quotationForm = readFileSync("apps/web/src/app/pages/quotation-form.component.ts", "utf8");

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
  for (const label of [
    "Subtotal neto",
    "Descuento por líneas",
    "Descuento global",
    "Descuento total",
    "Base imponible",
    "IVA",
    "Total línea, IVA incluido"
  ]) {
    assert.match(quotationForm, new RegExp(`>${label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}<`));
  }
  assert.doesNotMatch(quotationForm, />-\{\{\s*moneyLabel\(/);
  assert.match(designSystem, /\.quotation-line-financial\s*\{[^}]*grid-template-columns:/s);
  assert.match(designSystem, /\.quotation-line-financial\s+\.line-total\s*\{/);
});
