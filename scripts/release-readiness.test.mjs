import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release scripts and database safety commands are wired", () => {
  const packageJson = JSON.parse(readText("package.json"));

  assert.equal(packageJson.scripts["db:reset:dev"], "node scripts/db-reset-dev.mjs");
  assert.equal(packageJson.scripts["db:validate"], "node scripts/db-validate.mjs");
  assert.equal(packageJson.scripts["security:scan"], "node scripts/scan-secrets.mjs");
  assert.equal(packageJson.scripts["release:check"], "node scripts/release-check.mjs");
  assert.deepEqual(packageJson.engines, { node: ">=22 <25", pnpm: ">=9.15.4 <10" });
});

test("runtime config is generated and ignored instead of versioned", () => {
  const gitignore = readText(".gitignore");
  const webPackage = JSON.parse(readText("apps/web/package.json"));

  assert.match(gitignore, /apps\/web\/public\/runtime-config\.js/);
  assert.match(gitignore, /apps\/web\/public\/runtime-config\.json/);
  assert.match(webPackage.scripts.dev, /web:runtime-config/);
});

test("release check prints explicit ready or blocked state", () => {
  const script = readText("scripts/release-check.mjs");

  assert.match(script, /RELEASE READY/);
  assert.match(script, /RELEASE BLOCKED/);
  assert.match(script, /pnpm", \["e2e"\]/);
  assert.match(script, /pnpm", \["verify:full-local"\]/);
});

test("CI includes release gate essentials", () => {
  const ci = readText(".github/workflows/ci.yml");

  assert.match(ci, /node-version: 22/);
  assert.match(ci, /pnpm security:scan/);
  assert.match(ci, /pnpm audit --audit-level high/);
  assert.match(ci, /pnpm db:validate/);
  assert.match(ci, /pnpm verify:api-build/);
  assert.match(ci, /pnpm verify:i18n-server/);
  assert.match(ci, /pnpm e2e/);
});

function readText(path) {
  return readFileSync(path, "utf8");
}
