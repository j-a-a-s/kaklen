import assert from "node:assert/strict";
import test from "node:test";
import { auditFormSource } from "./forms-audit-core.mjs";

test("forms audit accepts standardized data-entry and search forms", () => {
  const source = `
    import { FormControlA11yDirective } from "./forms";
    @Component({ imports: [FormControlA11yDirective], template: \`
      <form [formGroup]="form" (ngSubmit)="save()">
        <kaklen-form-error-summary />
        <input type="email" inputmode="email" maxlength="254" formControlName="email" />
        <input type="tel" inputmode="tel" maxlength="24" formControlName="whatsapp" />
        <textarea maxlength="500" formControlName="notes"></textarea>
      </form>
      <form role="search"><input type="search" maxlength="80" formControlName="query" /></form>
    \`}) class Host {}
  `;
  assert.deepEqual(auditFormSource("host.ts", source).findings, []);
});

test("forms audit reports missing summaries, ARIA, formats, and lengths", () => {
  const source = `
    @Component({ template: \`
      <form [formGroup]="form" (ngSubmit)="save()">
        <input formControlName="email" />
        <input type="text" formControlName="phone" />
        <input type="number" formControlName="amount" />
        <textarea formControlName="notes"></textarea>
      </form>
    \`}) class Host {}
  `;
  const findings = auditFormSource("host.ts", source).findings.join("\n");
  assert.match(findings, /no error summary/);
  assert.match(findings, /shared ARIA directive/);
  assert.match(findings, /email must use type="email"/);
  assert.match(findings, /phone must use inputmode="tel"/);
  assert.match(findings, /amount has no numeric inputmode/);
  assert.match(findings, /notes has no maxlength/);
});
