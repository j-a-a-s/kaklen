import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release scripts and database safety commands are wired", () => {
  const packageJson = JSON.parse(readText("package.json"));

  assert.equal(packageJson.scripts["db:reset:dev"], "node scripts/db-reset-dev.mjs");
  assert.equal(packageJson.scripts["db:validate"], "node scripts/db-validate.mjs");
  assert.equal(packageJson.scripts["security:scan"], "node scripts/scan-secrets.mjs");
  assert.equal(packageJson.scripts["security:sast"], "node scripts/static-security-scan.mjs");
  assert.equal(packageJson.scripts["security:sbom"], "node scripts/generate-sbom.mjs");
  assert.equal(packageJson.scripts["dependency:audit"], "node scripts/dependency-audit.mjs");
  assert.equal(packageJson.scripts["architecture:check"], "node scripts/check-architecture.mjs");
  assert.equal(packageJson.scripts["quality:scan"], "node scripts/quality-scan.mjs");
  assert.equal(packageJson.scripts["release:check"], "node scripts/release-check.mjs");
  assert.equal(packageJson.scripts["release:check:strict"], "node scripts/release-check-strict.mjs");
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
  assert.match(script, /pnpm", \["verify:api-start"\]/);
  assert.match(script, /pnpm", \["mail:verify"\]/);
});

test("strict release check blocks until coverage and AWS staging are validated", () => {
  const script = readText("scripts/release-check-strict.mjs");
  const scorecard = readText("docs/release/TECHNICAL_SCORECARD.md");

  assert.match(script, /RELEASE READY 10\/10/);
  assert.match(script, /RELEASE BLOCKED/);
  assert.match(script, /AWS_STAGING_VALIDATED/);
  assert.match(script, /Coverage thresholds/);
  assert.match(scorecard, /AWS staging real no fue desplegado/);
});

test("CI includes release gate essentials", () => {
  const ci = readText(".github/workflows/ci.yml");
  const strictCi = readText(".github/workflows/strict-release.yml");

  assert.match(ci, /node-version: 22/);
  assert.match(ci, /pnpm security:scan/);
  assert.match(ci, /pnpm quality:scan/);
  assert.match(ci, /pnpm architecture:check/);
  assert.match(ci, /pnpm security:sast/);
  assert.match(ci, /pnpm security:sbom/);
  assert.match(ci, /pnpm dependency:audit/);
  assert.match(ci, /pnpm db:validate/);
  assert.match(ci, /pnpm verify:api-build/);
  assert.match(ci, /pnpm verify:i18n-server/);
  assert.match(ci, /pnpm accessibility:test/);
  assert.match(ci, /pnpm e2e/);
  assert.match(strictCi, /pnpm release:check:strict/);
});

function readText(path) {
  return readFileSync(path, "utf8");
}
