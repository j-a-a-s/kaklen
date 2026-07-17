import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("release scripts and database safety commands are wired", () => {
  const packageJson = JSON.parse(readText("package.json"));

  assert.equal(packageJson.scripts["db:reset:dev"], "node scripts/db-reset-dev.mjs");
  assert.equal(packageJson.scripts["db:validate"], "node scripts/db-validate.mjs");
  assert.equal(packageJson.scripts["db:verify:migrations"], "node scripts/verify-migrations.mjs");
  assert.equal(packageJson.scripts["security:scan"], "node scripts/scan-secrets.mjs");
  assert.equal(packageJson.scripts["security:sast"], "node scripts/static-security-scan.mjs");
  assert.equal(packageJson.scripts["security:sbom"], "node scripts/generate-sbom.mjs");
  assert.equal(packageJson.scripts["dependency:audit"], "node scripts/dependency-audit.mjs");
  assert.equal(packageJson.scripts["architecture:check"], "node scripts/check-architecture.mjs");
  assert.equal(packageJson.scripts["quality:scan"], "node scripts/quality-scan.mjs");
  assert.equal(packageJson.scripts["quality:gate"], "node scripts/quality-pipeline.mjs quality:gate");
  assert.equal(packageJson.scripts["quality:gate:ci"], "node scripts/quality-pipeline.mjs quality:gate:ci");
  assert.equal(packageJson.scripts["release:check"], "node scripts/quality-pipeline.mjs release:check");
  assert.equal(packageJson.scripts["release:check:strict"], "node scripts/quality-pipeline.mjs release:check:strict");
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
  const script = readText("scripts/quality-pipeline.mjs");
  const graph = readText("scripts/quality-pipeline-core.mjs");

  assert.match(script, /RELEASE READY/);
  assert.match(script, /QUALITY GATE FAILED/);
  assert.match(graph, /defineTask\("e2e"/);
  assert.match(graph, /\["mail:verify"\]/);
  assert.match(graph, /\["db:verify:migrations"\]/);
});

test("strict release profile blocks until all external criteria are validated", () => {
  const graph = readText("scripts/quality-pipeline-core.mjs");
  const external = readText("scripts/verify-external-readiness.mjs");
  const scorecardCore = readText("scripts/technical-scorecard-core.mjs");

  assert.match(graph, /"release:check:strict"/);
  assert.match(graph, /"external-readiness"/);
  assert.match(external, /AWS_STAGING_VALIDATED/);
  assert.match(external, /REAL_WHATSAPP_VALIDATED/);
  assert.match(external, /PRODUCTION_PAYMENT_GATEWAY_VALIDATED/);
  assert.match(scorecardCore, /COVERAGE_THRESHOLDS/);
});

test("CI exposes one canonical quality check without repeating graph tasks", () => {
  const ci = readText(".github/workflows/ci.yml");

  assert.match(ci, /name: Kaklen Quality Gate/);
  assert.match(ci, /node-version: 22/);
  assert.match(ci, /postgres:16-alpine/);
  assert.match(ci, /redis:7-alpine/);
  assert.match(ci, /axllent\/mailpit:v1\.23/);
  assert.match(ci, /pnpm quality:gate:ci/);
  for (const repeated of ["pnpm security:scan", "pnpm lint", "pnpm test", "pnpm build", "pnpm e2e"]) {
    assert.doesNotMatch(ci, new RegExp(repeated));
  }
});

function readText(path) {
  return readFileSync(path, "utf8");
}
