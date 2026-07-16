import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("api scripts clean, build, start, and dev guard compiled output", () => {
  const packageJson = JSON.parse(readText("apps/api/package.json"));

  assert.equal(packageJson.scripts.clean, "node ../../scripts/clean-api-dist.mjs");
  assert.match(packageJson.scripts.build, /pnpm run clean/);
  assert.match(packageJson.scripts.build, /tsc -p tsconfig\.build\.json/);
  assert.match(packageJson.scripts.build, /verify-api-build\.mjs --files-only/);
  assert.match(packageJson.scripts.start, /verify-api-build\.mjs --files-only/);
  assert.match(packageJson.scripts.start, /node dist\/main\.js/);
  assert.match(packageJson.scripts.dev, /pnpm run clean/);
  assert.match(packageJson.scripts.dev, /nest start --watch/);
  assert.equal(packageJson.dependencies.express, "^5.2.1");
});

test("api build tsconfig includes src and does not exclude prisma", () => {
  const tsconfig = JSON.parse(readText("apps/api/tsconfig.build.json"));

  assert.deepEqual(tsconfig.include, ["src/**/*.ts"]);
  assert.ok(!JSON.stringify(tsconfig.exclude).includes("src/prisma"));
});

test("verify:api-build checks required files and relative requires", () => {
  const packageJson = JSON.parse(readText("package.json"));
  const script = readText("scripts/verify-api-build.mjs");

  assert.equal(packageJson.scripts["verify:api-build"], "node scripts/verify-api-build.mjs");
  assert.match(script, /"prisma\/prisma\.service\.js"/);
  assert.match(script, /"health\/health\.service\.js"/);
  assert.match(script, /relativeRequireSpecifiers/);
  assert.match(script, /localRequire\.resolve\(specifier\)/);
  assert.match(script, /Build API incompleto/);
  assert.match(script, /MODULE_NOT_FOUND/);
  assert.match(script, /api\/health\/live/);
});

test("api clean removes the complete dist directory", () => {
  const script = readText("scripts/clean-api-dist.mjs");

  assert.match(script, /apps\/api\/dist/);
  assert.match(script, /rmSync\(apiDist, \{ recursive: true, force: true \}\)/);
});

test("dev:full:i18n cleans API dist before starting watch mode", () => {
  const script = readText("scripts/dev-full-i18n.mjs");
  const cleanIndex = script.indexOf('["--filter", "@kaklen/api", "clean"]');
  const devIndex = script.indexOf('resolve("apps/api/node_modules/@nestjs/cli/bin/nest.js")');

  assert.ok(cleanIndex > 0);
  assert.ok(devIndex > cleanIndex);
  assert.doesNotMatch(script, /\["--filter", "@kaklen\/api", "dev"\]/);
});

function readText(path) {
  return readFileSync(path, "utf8");
}
