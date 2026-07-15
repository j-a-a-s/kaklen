import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

async function source(path) {
  return readFile(new URL(path, root), "utf8");
}

test("brand assets are versioned PNG files", async () => {
  for (const asset of ["apps/web/public/brand/logo-kaklen.png", "apps/web/public/brand/logo-texto.png"]) {
    const file = await readFile(new URL(asset, root));
    assert.deepEqual([...file.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
    assert.ok((await stat(new URL(asset, root))).size > 1_000);
  }
});

test("public shell owns one locale selector and authenticated navigation", async () => {
  const main = await source("apps/web/src/main.ts");
  assert.equal((main.match(/<kaklen-locale-selector\s*\/>/g) ?? []).length, 1);
  assert.match(main, /<kaklen-brand-logo\s*\/>/);
  assert.match(main, /<kaklen-command-palette/);
  assert.match(main, /class="app-sidebar"/);
  assert.match(main, /can\(['"]clients\.read['"]\)/);
  assert.match(main, /can\(['"]catalog\.read['"]\)/);
  assert.match(main, /can\(['"]quotations\.read['"]\)/);
  assert.match(main, /can\(['"]events\.read['"]\)/);
});

test("auth pages use institutional branding without duplicating locale selection", async () => {
  for (const path of ["apps/web/src/app/pages/login.component.ts", "apps/web/src/app/pages/register.component.ts"]) {
    const page = await source(path);
    assert.match(page, /<kaklen-brand-logo variant="signature"\s*\/>/);
    assert.doesNotMatch(page, /kaklen-locale-selector/);
  }
});

test("dashboard communicates metrics onboarding and next action", async () => {
  const dashboard = await source("apps/web/src/app/pages/dashboard.component.ts");
  assert.match(dashboard, /class="metric-card-grid"/);
  assert.match(dashboard, /class="quick-action-grid"/);
  assert.match(dashboard, /class="onboarding-list"/);
  assert.match(dashboard, /recommendedStep\(\)/);
  assert.match(dashboard, /dashboard-skeleton/);
});

test("design system includes responsive accessible and dark-mode foundations", async () => {
  const css = await source("apps/web/src/design-system.css");
  assert.match(css, /--color-brand:/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\[data-theme="dark"\]/);
  assert.match(css, /@media \(min-width: 900px\)/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("design documentation covers system guidelines flow library and audit", async () => {
  for (const document of [
    "docs/design/DESIGN_SYSTEM.md",
    "docs/design/UX_GUIDELINES.md",
    "docs/design/USER_FLOW.md",
    "docs/design/COMPONENT_LIBRARY.md",
    "docs/design/UX_AUDIT.md"
  ]) {
    const contents = await source(document);
    assert.ok(contents.length > 500, `${document} must contain actionable guidance`);
  }
});
