import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("all action-menu consumers use the shared accessible component", () => {
  const consumers = [
    "apps/web/src/app/pages/quotation-detail.component.ts",
    "apps/web/src/app/pages/event-detail.component.ts",
    "apps/web/src/app/pages/client-detail.component.ts",
    "apps/web/src/app/pages/clients-list.component.ts",
    "apps/web/src/app/pages/catalog-detail.component.ts",
    "apps/web/src/app/pages/catalog-list.component.ts",
    "apps/web/src/app/pages/organization-members.component.ts",
    "apps/web/src/main.ts"
  ];
  for (const path of consumers) {
    assert.match(read(path), /<kaklen-action-menu/);
  }
  const application = consumers.map(read).join("\n");
  assert.doesNotMatch(application, /<details[^>]+action-menu/);

  const menu = read("apps/web/src/app/shared/action-menu.component.ts");
  for (const behavior of ["document:pointerdown", "NavigationStart", "contextKey", "ArrowDown", "ArrowUp", "Home", "End", "Escape", "updatePlacement", "overlays.open"]) {
    assert.ok(menu.includes(behavior), `missing action-menu behavior: ${behavior}`);
  }
});

test("button variants, long labels, tooltips, and shared icons follow one design contract", () => {
  const css = read("apps/web/src/design-system.css");
  assert.match(css, /--color-brand:\s*#1769d2/);
  assert.match(css, /--color-success:\s*#147d64/);
  assert.match(css, /--color-danger:\s*#b4232e/);
  assert.match(css, /white-space:\s*nowrap/);
  assert.doesNotMatch(css, /word-break:\s*break-all/);
  assert.match(read("apps/web/src/app/shared/ui-icon.component.ts"), /lucide/);
});

test("action center exposes every route, RBAC check, search group, and keyboard safeguard", () => {
  const palette = read("apps/web/src/app/shared/command-palette.component.ts");
  const registry = read("apps/web/src/app/shared/action-registry.service.ts");
  for (const action of ["create-client", "create-catalog", "create-quotation", "create-event", "invite-member", "change-organization"]) {
    assert.ok(registry.includes(action), `missing action center command: ${action}`);
  }
  for (const group of ["clients", "catalogItems", "quotations", "events"]) {
    assert.ok(palette.includes(group), `missing action center search group: ${group}`);
  }
  assert.match(registry, /permissions:/);
  assert.match(palette, /organizationService\.hasPermission/);
  assert.match(palette, /event\.preventDefault\(\)/);
  assert.match(palette, /event\.stopPropagation\(\)/);
  assert.match(palette, /trapFocus/);
  assert.match(palette, /command-palette-open/);
});

test("forms share database limits, normalization, feedback, and summaries", () => {
  const validators = read("apps/web/src/app/shared/forms/form-validators.ts");
  const feedback = read("apps/web/src/app/shared/forms/form-feedback.components.ts");
  assert.match(validators, /VALIDATION_LIMITS/);
  for (const rule of ["emailValidator", "internationalPhoneValidator", "decimalValidator", "dateOrderValidator", "trimmedRequired", "normalizeEmail", "normalizePhone"]) {
    assert.ok(validators.includes(rule), `missing shared validation rule: ${rule}`);
  }
  for (const component of ["kaklen-required", "kaklen-optional", "kaklen-field-error", "kaklen-form-error-summary"]) {
    assert.ok(feedback.includes(component), `missing shared feedback component: ${component}`);
  }
});

test("quotation totals use one scaled-integer algorithm on frontend and API", () => {
  const money = read("packages/shared/src/quotation-money.ts");
  const form = read("apps/web/src/app/pages/quotation-form.component.ts");
  assert.match(money, /bigint/);
  assert.match(money, /distributeGlobalDiscount/);
  assert.match(money, /net:\s*line\.subtotal - line\.lineDiscount/);
  assert.match(money, /filter\(\(\{ net \}\) => net > 0n\)/);
  assert.doesNotMatch(money, /eligibleForGlobalDiscount/);
  assert.match(money, /remainder[\s\S]*residual/);
  assert.doesNotMatch(money, /parseFloat|toFixed\(/);
  assert.match(form, /calculateQuotationMoney/);
  assert.doesNotMatch(form, /currentStep\(\) === 3"[^>]*formArrayName="items"/);
  assert.match(form, /<ng-container formArrayName="items">/);
  assert.match(read("apps/api/src/quotations/quotations.service.ts"), /calculateQuotationMoney/);
});

test("quotation PDF and email remain authenticated, tenant-scoped, and SMTP-backed", () => {
  const frontend = read("apps/web/src/app/quotations/quotations.service.ts");
  const component = read("apps/web/src/app/pages/quotation-detail.component.ts");
  const api = read("apps/api/src/quotations/quotations.service.ts");
  assert.match(frontend, /responseType:\s*"blob"/);
  assert.match(frontend, /observe:\s*"response"/);
  assert.doesNotMatch(frontend, /token=/i);
  assert.match(component, /URL\.createObjectURL/);
  assert.match(component, /URL\.revokeObjectURL/);
  assert.match(api, /attachments:\s*\[\{ filename: document\.filename/);
  assert.match(api, /await this\.mailService\.send[\s\S]*this\.prisma\.\$transaction/);
  assert.match(api, /this\.findQuotation\(organizationId, quotationId/);
});

test("quotation history and new UI copy are localized in every catalog", () => {
  const requiredIds = [
    "historyQuotationCreated", "historyQuotationSent", "historyQuotationApproved", "historyQuotationRejected",
    "historyQuotationCancelled", "historyQuotationVersionCreated", "historyQuotationEmailed", "fieldRequiredError",
    "phoneValidation", "sendQuotationEmailTitle", "pdfDownloadedSuccess", "openWeeklyEventAriaLabel"
  ];
  for (const locale of ["es", "en", "pt-BR"]) {
    const xlf = read(`apps/web/src/locale/messages.${locale}.xlf`);
    const ids = [...xlf.matchAll(/<trans-unit id="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${locale} contains duplicate translation ids`);
    for (const id of requiredIds) {
      assert.match(xlf, new RegExp(`<trans-unit id="${id}"[\\s\\S]*?<target>[^<]`));
    }
  }
});

test("weekly events are complete links with explicit Space activation", () => {
  const calendar = read("apps/web/src/app/pages/event-calendar.component.ts");
  assert.match(calendar, /class="item-row weekly-event-link"/);
  assert.match(calendar, /\[routerLink\]=/);
  assert.match(calendar, /\(keydown\.space\)="openWeeklyEvent/);
  assert.match(calendar, /event\.client\?\.displayName/);
  assert.match(calendar, /eventStatus\(event\.status\)/);
});

test("stabilization decisions have non-trivial operational documentation", () => {
  for (const path of [
    "docs/design/INTERACTION_PATTERNS.md",
    "docs/forms/VALIDATION_STANDARD.md",
    "docs/quotations/MONEY_CALCULATION.md",
    "docs/quotations/PDF_AND_EMAIL_FLOW.md",
    "docs/testing/ACTION_CENTER_TEST_MATRIX.md"
  ]) {
    assert.ok(read(path).length > 900, `${path} must contain actionable guidance`);
  }
});
