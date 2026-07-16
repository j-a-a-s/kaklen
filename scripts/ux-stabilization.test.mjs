import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("organization navigation exposes one current page contract per link", async () => {
  const main = await source("apps/web/src/main.ts");
  const navigation = main.match(/<aside[\s\S]*?<\/aside>/)?.[0] ?? "";
  const links = navigation.match(/<a\b[\s\S]*?<\/a>/g) ?? [];

  assert.equal(links.length, 7);
  for (const link of links) {
    assert.match(link, /routerLinkActive="active"/);
    assert.match(link, /ariaCurrentWhenActive="page"/);
  }
  assert.match(links[0], /routerLinkActiveOptions]="\{ exact: true \}"/);
  assert.ok(links.slice(1).every((link) => link.includes('routerLinkActiveOptions]="{ exact: false }"')));
});

test("stored organization context rehydrates backend permissions", async () => {
  const service = await source("apps/web/src/app/organizations/organization.service.ts");
  assert.match(service, /const requestedOrganization = organizations\.find/);
  assert.match(service, /await this\.setActiveOrganization\(organizationToActivate\.id\)/);
  assert.match(service, /setActiveOrganization\([\s\S]*await this\.loadPermissions\(organizationId\)/);
});

test("semantic actions use blue green red and neutral contracts", async () => {
  const css = await source("apps/web/src/design-system.css");
  assert.match(css, /--color-brand:\s*#1769d2/);
  assert.match(css, /--color-success:\s*#147d64/);
  assert.match(css, /--color-danger:\s*#b4232e/);
  assert.match(css, /button\.success,[\s\S]*background: var\(--color-success\)/);
  assert.match(css, /button\.danger\s*\{[\s\S]*background: var\(--color-danger\)/);
  assert.match(css, /button\.secondary,[\s\S]*background: var\(--color-surface\)/);
});

test("persisted technical values are mapped to localized labels", async () => {
  const labels = await source("apps/web/src/app/i18n/display-labels.ts");
  for (const value of [
    "DRAFT",
    "SENT",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
    "IN_PROGRESS",
    "OWNER",
    "VIEWER",
    "CLP",
    "America/Santiago"
  ]) {
    assert.ok(labels.includes(value));
  }
  assert.match(labels, /@@draftLabel:Borrador/);
  assert.match(labels, /@@viewerOrganizationRole:Solo lectura/);
  assert.match(labels, /@@timezoneSantiagoLabel:Santiago, Chile/);
});

test("CLP formatting uses Intl and omits zero decimal places", async () => {
  const formatting = await source("apps/web/src/app/i18n/formatting.ts");
  assert.match(formatting, /new Intl\.NumberFormat/);
  assert.match(formatting, /Number\.isInteger\(amount\) \? 0 : 2/);

  const label = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    currencyDisplay: "narrowSymbol",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(59_500);
  assert.equal(label.replace(/\u00a0/g, " "), "$59.500");
});

test("mobile drawer traps focus closes with escape and restores focus", async () => {
  const main = await source("apps/web/src/main.ts");
  const css = await source("apps/web/src/design-system.css");
  assert.match(main, /class="drawer-overlay"/);
  assert.match(main, /event\.key === "Escape"/);
  assert.match(main, /this\.trapFocus\(event, this\.mobileDrawer/);
  assert.match(main, /this\.closeMenu\(true\)/);
  assert.match(main, /document\.body\.classList\.add\("navigation-drawer-open"\)/);
  assert.match(main, /ngOnDestroy\(\)[\s\S]*classList\.remove\("navigation-drawer-open"\)/);
  assert.match(css, /\.app-sidebar\s*\{[\s\S]*width: 86vw;[\s\S]*max-width: 360px/);
  assert.match(css, /body\.navigation-drawer-open\s*\{[\s\S]*overflow: hidden/);
});

test("mobile header keeps the account menu closed until profile activation", async () => {
  const css = await source("apps/web/src/design-system.css");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.topbar \.account-menu\s*\{[\s\S]*display: none/);
  assert.match(css, /\.topbar \.account-menu\.open\s*\{[\s\S]*display: grid/);
});

test("operational lists expose compact mobile filters and active chips", async () => {
  for (const page of ["clients-list", "catalog-list", "quotation-list", "event-list"]) {
    const contents = await source(`apps/web/src/app/pages/${page}.component.ts`);
    assert.match(contents, /class="[^"]*filters-panel[^"]*"/);
    assert.match(contents, /filtersOpen/);
    assert.match(contents, /class="active-filter-chips"/);
    assert.match(contents, /(?:clear|reset)Filters\(\)/);
  }
  const css = await source("apps/web/src/design-system.css");
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*\.filter-controls\s*\{[\s\S]*display: none/);
});

test("quotation creation is a four-stage validated wizard with responsive summary", async () => {
  const quotation = await source("apps/web/src/app/pages/quotation-form.component.ts");
  assert.equal((quotation.match(/<li \[class\.active\]="currentStep\(\) === [1-4]"/g) ?? []).length, 4);
  assert.match(quotation, /nextStep\(\)[\s\S]*validateStep\(step\)/);
  assert.match(quotation, /private validateStep\(step: number\)/);
  assert.match(quotation, /class="quotation-summary desktop-quotation-summary"/);
  assert.match(quotation, /class="mobile-quotation-summary"/);
  assert.match(quotation, /subtotal\(\)/);
  assert.match(quotation, /discountTotal\(\)/);
  assert.match(quotation, /taxTotal\(\)/);
  assert.match(quotation, /grandTotal\(\)/);
});

test("destructive actions require an explicit dialog and prevent duplicate submits", async () => {
  const pages = ["clients-list", "client-detail", "catalog-list", "quotation-detail", "event-detail", "organization-members"];
  for (const page of pages) {
    const contents = await source(`apps/web/src/app/pages/${page}.component.ts`);
    assert.match(contents, /<kaklen-confirmation-dialog/);
    assert.match(contents, /class="action-menu"/);
    assert.match(contents, /\[busy\]="(?:loading|processing)\(\)"/);
  }
  const dialog = await source("apps/web/src/app/shared/confirmation-dialog.component.ts");
  assert.match(dialog, /role="alertdialog"/);
  assert.match(dialog, /aria-modal="true"/);
  assert.match(dialog, /document:keydown\.escape/);
  assert.match(dialog, /\[disabled\]="busy"/);
});

test("organization settings expose friendly validated options", async () => {
  const settings = await source("apps/web/src/app/pages/organization-settings.component.ts");
  for (const control of ["country", "currency", "timezone", "dateFormat", "numberFormat", "defaultLocale"]) {
    assert.match(settings, new RegExp(`<select formControlName="${control}"`));
  }
  assert.match(settings, /Peso chileno \(CLP\)/);
  assert.match(settings, /Santiago, Chile/);
  assert.match(settings, /Día-mes-año/);
  assert.match(settings, /Español/);
});

test("client workflow groups fields and hides infeasible quick actions", async () => {
  const form = await source("apps/web/src/app/pages/client-form.component.ts");
  const detail = await source("apps/web/src/app/pages/client-detail.component.ts");
  assert.equal((form.match(/<fieldset class="form-section wizard-stage"/g) ?? []).length, 4);
  assert.match(form, /class="form-section client-review wizard-stage"/);
  assert.match(form, /currentStep\(\) === 4/);
  assert.match(form, /class="form-error-summary"/);
  assert.match(form, /phonePrefix/);
  assert.match(form, /formatRut/);
  assert.match(detail, /\*ngIf="currentClient\.phone"/);
  assert.match(detail, /\*ngIf="currentClient\.email"/);
  assert.match(detail, /\*ngIf="canCreateQuotation\(\)"/);
  assert.match(detail, /\*ngIf="canCreateEvent\(\)"/);
});

test("dashboard metric and completed onboarding layouts adapt by viewport", async () => {
  const dashboard = await source("apps/web/src/app/pages/dashboard.component.ts");
  const css = await source("apps/web/src/design-system.css");
  assert.match(dashboard, /summary\.activation\.isCompleted/);
  assert.match(dashboard, /summary\.activation\.percentage/);
  assert.match(dashboard, /showOnboardingDetails/);
  assert.match(css, /grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /grid-template-columns: repeat\(5, minmax\(0, 1fr\)\)/);
});
