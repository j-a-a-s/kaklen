import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CLEAN_DEV_TARGETS, PRESERVED_TARGETS } from "./clean-dev.mjs";
import { createRuntimeConfig } from "./write-runtime-config.mjs";
import { shortCommitSha } from "./build-info.mjs";

test("runtime config includes public version fields", () => {
  const config = createRuntimeConfig();

  assert.equal(typeof config.version, "string");
  assert.equal(typeof config.commitSha, "string");
  assert.equal(typeof config.buildTime, "string");
  assert.equal(typeof config.apiBaseUrl, "string");
});

test("commit SHA is shortened to seven characters", () => {
  assert.equal(shortCommitSha("95b0798abcdef"), "95b0798");
  assert.equal(shortCommitSha(""), "local");
});

test("clean-dev preserves environment and dependencies", () => {
  assert.equal(CLEAN_DEV_TARGETS.includes(".env"), false);
  assert.equal(CLEAN_DEV_TARGETS.includes("node_modules"), false);
  assert.equal(PRESERVED_TARGETS.includes(".env"), true);
  assert.equal(PRESERVED_TARGETS.includes("node_modules"), true);
});

test("login, register, and authenticated layout render the version badge", () => {
  const login = readText("apps/web/src/app/pages/login.component.ts");
  const register = readText("apps/web/src/app/pages/register.component.ts");
  const shell = readText("apps/web/src/main.ts");

  assert.match(login, /<kaklen-version-badge \/>/);
  assert.match(register, /<kaklen-version-badge \/>/);
  assert.match(shell, /<kaklen-version-badge \/>/);
});

test("version badge has a visible fallback when runtime config is unavailable", () => {
  const badge = readText("apps/web/src/app/version/version-badge.component.ts");
  const service = readText("apps/web/src/app/version/version.service.ts");

  assert.match(badge, /Versión no disponible/);
  assert.match(service, /this\.unavailable\.set\(true\)/);
});

test("version service detects a different version without notifying on the same identity", () => {
  const service = readText("apps/web/src/app/version/version.service.ts");

  assert.match(service, /this\.identity\(latest\) !== this\.loadedIdentity/);
  assert.match(service, /Hay una nueva versión de Kaklen disponible/);
  assert.match(service, /Actualizar ahora/);
});

test("dev:fresh regenerates runtime config before starting development servers", () => {
  const script = readText("scripts/dev-fresh.mjs");

  assert.ok(script.indexOf("writeRuntimeConfig()") < script.indexOf('run("turbo", ["run", "dev"'));
  assert.match(script, /APP_VERSION: config\.version/);
  assert.match(script, /COMMIT_SHA: config\.commitSha/);
  assert.match(script, /BUILD_TIME: config\.buildTime/);
});

function readText(path) {
  return readFileSync(path, "utf8");
}
