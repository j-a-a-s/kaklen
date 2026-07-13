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

test("version panel is hidden initially and only mounted by login", () => {
  const login = readText("apps/web/src/app/pages/login.component.ts");
  const register = readText("apps/web/src/app/pages/register.component.ts");
  const dashboard = readText("apps/web/src/app/pages/dashboard.component.ts");
  const shell = readText("apps/web/src/main.ts");

  assert.match(login, /versionPanelVisible = signal\(false\)/);
  assert.match(login, /<kaklen-version-badge \*ngIf="versionPanelVisible\(\)"/);
  assert.doesNotMatch(register, /kaklen-version-badge/);
  assert.doesNotMatch(dashboard, /kaklen-version-badge|versionPanel|VersionService/);
  assert.doesNotMatch(shell, /kaklen-version-badge/);
  assert.doesNotMatch(shell, /VersionService/);
});

test("version panel renders required accessible build metadata", () => {
  const badge = readText("apps/web/src/app/version/version-badge.component.ts");
  const service = readText("apps/web/src/app/version/version.service.ts");

  assert.match(badge, /role="status"/);
  assert.match(badge, /aria-live="polite"/);
  assert.match(badge, /@@versionLabel/);
  assert.match(badge, /@@commitLabel/);
  assert.match(badge, /@@buildTimeLabel/);
  assert.match(badge, /@@environmentLabel/);
  assert.match(badge, /@@closeVersionInfoLabel/);
  assert.match(badge, /Versión no disponible/);
  assert.match(service, /this\.unavailable\.set\(true\)/);
});

test("login toggles version panel with Cmd or Ctrl plus K followed by O", () => {
  const login = readText("apps/web/src/app/pages/login.component.ts");
  const keyboard = readText("apps/web/src/app/shared/keyboard-sequence.service.ts");

  assert.match(login, /timeoutMs: 1500/);
  assert.match(login, /toggleVersionPanel\(\)/);
  assert.match(keyboard, /event\.metaKey \|\| event\.ctrlKey/);
  assert.match(keyboard, /key === PRIMARY_KEY/);
  assert.match(keyboard, /key === SECONDARY_KEY/);
});

test("expired sequence, O without sequence, and repeated keys do not open the panel", () => {
  const keyboard = readText("apps/web/src/app/shared/keyboard-sequence.service.ts");

  assert.match(keyboard, /window\.setTimeout\(clear, options\.timeoutMs\)/);
  assert.match(keyboard, /waitingForSecondaryKey && !primaryModifierPressed && key === SECONDARY_KEY/);
  assert.match(keyboard, /if \(event\.repeat\)/);
});

test("keyboard shortcut works while inputs are focused and prevents browser command palette", () => {
  const keyboard = readText("apps/web/src/app/shared/keyboard-sequence.service.ts");

  assert.match(keyboard, /window\.addEventListener\("keydown", onKeyDown, \{ capture: true \}\)/);
  assert.match(keyboard, /event\.preventDefault\(\)/);
});

test("Escape and close button hide the version panel", () => {
  const login = readText("apps/web/src/app/pages/login.component.ts");
  const badge = readText("apps/web/src/app/version/version-badge.component.ts");

  assert.match(login, /document:keydown\.escape/);
  assert.match(login, /hideVersionPanel\(\)/);
  assert.match(badge, /\(click\)="closed\.emit\(\)"/);
});

test("version shortcut listener is removed when login is destroyed", () => {
  const login = readText("apps/web/src/app/pages/login.component.ts");
  const keyboard = readText("apps/web/src/app/shared/keyboard-sequence.service.ts");
  const version = readText("apps/web/src/app/version/version.service.ts");

  assert.match(login, /ngOnDestroy\(\)/);
  assert.match(login, /this\.stopVersionShortcut\?\.\(\)/);
  assert.match(login, /this\.versionService\.stop\(\)/);
  assert.match(keyboard, /window\.removeEventListener\("keydown", onKeyDown, \{ capture: true \}\)/);
  assert.match(version, /window\.clearInterval\(this\.intervalId\)/);
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
