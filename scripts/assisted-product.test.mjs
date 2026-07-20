import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { deterministicUuid, formatRut, isValidRut } from "./demo-data.mjs";

const read = (path) => readFileSync(path, "utf8");

test("demo helpers produce stable UUIDs and valid fictional RUTs", () => {
  assert.equal(deterministicUuid("organization:demo"), deterministicUuid("organization:demo"));
  assert.notEqual(deterministicUuid("organization:demo"), deterministicUuid("organization:other"));
  assert.equal(isValidRut(formatRut(76111001)), true);
});

test("assisted product services derive activation and scope search by tenant", () => {
  const activation = read("apps/api/src/assistant/user-activation.service.ts");
  const assistant = read("apps/api/src/assistant/assistant.service.ts");
  assert.match(activation, /ACTIVATION_STEPS\.filter/);
  assert.doesNotMatch(activation, /activation\.(create|update|upsert)/);
  assert.match(assistant, /WHERE "organizationId" = \$\{organizationId\}/);
  assert.match(assistant, /unaccent\(lower/);
  assert.match(assistant, /Math\.min\(limit \* 3, 90\)/);
});

test("command palette is keyboard complete, permission aware, and query efficient", () => {
  const source = read("apps/web/src/app/shared/command-palette.component.ts");
  assert.match(source, /ArrowDown/);
  assert.match(source, /ArrowUp/);
  assert.match(source, /event\.key === "Enter"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /trapFocus/);
  assert.match(source, /setTimeout\(\(\) => void this\.search\(value, sequence\), 250\)/);
  assert.match(source, /value\.trim\(\)\.length < 2/);
  assert.match(source, /hasPermission/);
  assert.doesNotMatch(source, /localStorage\.setItem\([^\n]*(query|result)/i);
});

test("guided workflows preserve the requested step counts and safeguards", () => {
  const client = read("apps/web/src/app/pages/client-form.component.ts");
  const quotation = read("apps/web/src/app/pages/quotation-form.component.ts");
  const event = read("apps/web/src/app/pages/event-form.component.ts");
  assert.match(client, /Math\.min\(4,/);
  assert.match(client, /saveBasic/);
  assert.match(client, /chileanRutValidator/);
  assert.match(quotation, /globalDiscountPercent/);
  assert.match(quotation, /Math\.min\(4,/);
  assert.match(quotation, /calculateQuotationMoney/);
  assert.match(event, /Math\.min\(5,/);
  assert.match(event, /Promise\.allSettled/);
  assert.match(event, /createFromQuotation/);
});

test("product analytics is typed and cannot accept personal form fields", () => {
  const source = read("apps/web/src/app/assistant/product-analytics.service.ts");
  for (const event of ["onboarding_started", "first_client_created", "first_quotation_created", "first_event_created", "global_search_used", "wizard_abandoned", "wizard_completed"]) {
    assert.match(source, new RegExp(`\\| "${event}"`));
  }
  assert.doesNotMatch(source, /email\??:|taxId\??:|rut\??:|firstName\??:|lastName\??:/i);
});

test("all assisted translations exist in es, en, and pt-BR", () => {
  const ids = ["recommendedNextStepEyebrow", "commandPaletteTitle", "clientProgressLabel", "globalDiscountLabel", "eventStepReview", "clientTimelineTitle", "recentActivityTitle"];
  for (const locale of ["es", "en", "pt-BR"]) {
    const xlf = read(`apps/web/src/locale/messages.${locale}.xlf`);
    for (const id of ids) {
      assert.match(xlf, new RegExp(`<trans-unit id="${id}"[\\s\\S]*?<target>[^<]`));
    }
  }
});

test("quality gate includes every mandatory assisted-product control", () => {
  const source = read("scripts/quality-pipeline-core.mjs");
  for (const command of ["architecture:check", "quality:scan", "security:scan", "db:verify:migrations", "db:verify:demo", "test:coverage", "verify:api-build", "verify:i18n-server", "accessibility:test"]) {
    assert.match(source, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.doesNotMatch(source, /\["release:check"\]/);
  assert.match(read("scripts/quality-pipeline.mjs"), /QUALITY GATE PASSED/);
  assert.match(read("scripts/quality-pipeline.mjs"), /QUALITY GATE FAILED/);
});

test("authenticated E2E navigation waits for session responses without fixed sleeps", () => {
  const assistedJourney = read("e2e/assisted-product.spec.mjs");
  const coreJourney = read("e2e/mvp.spec.mjs");

  assert.match(assistedJourney, /waitForResponse\([\s\S]*\/api\/auth\/refresh/);
  assert.match(assistedJourney, /waitForResponse\([\s\S]*\/api\/auth\/logout/);
  assert.match(coreJourney, /waitForResponse\([\s\S]*\/api\/auth\/refresh/);
  assert.doesNotMatch(`${assistedJourney}\n${coreJourney}`, /waitForTimeout|new Promise[^;]+setTimeout/);
});
