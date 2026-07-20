import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import {
  API_INTEGRATION_TEST_REGEX,
  API_UNIT_TEST_REGEX,
  resolveApiTestMode
} from "./api-test-contract.mjs";
import { parseStartArguments, startHelp } from "./start-command.mjs";

const packageJson = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const repositoryRoot = new URL("../", import.meta.url);

test("start uses the existing fresh development command by default", () => {
  assert.deepEqual(parseStartArguments([]), {
    kind: "run",
    mode: "default",
    script: "dev:fresh"
  });
});

test("start selects each localized development mode", () => {
  assert.equal(parseStartArguments(["--mode=i18n"]).script, "dev:i18n");
  assert.equal(parseStartArguments(["--mode", "full"]).script, "dev:full:i18n");
  assert.equal(parseStartArguments(["--", "--mode=full"]).script, "dev:full:i18n");
});

test("start help documents every public mode", () => {
  assert.deepEqual(parseStartArguments(["--help"]), { kind: "help" });
  assert.match(startHelp(), /sin flags/);
  assert.match(startHelp(), /--mode=i18n/);
  assert.match(startHelp(), /--mode=full/);
});

test("start rejects invalid, empty, repeated, and unknown options", () => {
  for (const args of [
    ["--mode=invalid"],
    ["--mode="],
    ["--mode=i18n", "--mode=full"],
    ["--unknown"]
  ]) {
    assert.equal(parseStartArguments(args).kind, "error", args.join(" "));
  }
});

test("start CLI prints help and exits 1 for an invalid mode", () => {
  const help = runStart(["--help"]);
  assert.equal(help.status, 0);
  assert.match(help.stdout, /Uso: pnpm start/);

  const invalid = runStart(["--mode=invalid"]);
  assert.equal(invalid.status, 1);
  assert.match(invalid.stderr, /Modo inválido/);
});

test("root scripts expose the four public commands and retain compatibility aliases", () => {
  assert.equal(packageJson.scripts.start, "node scripts/start.mjs");
  assert.equal(packageJson.scripts.check, "node scripts/quality-pipeline.mjs check");
  assert.equal(packageJson.scripts["quality:gate"], "node scripts/quality-pipeline.mjs quality:gate");
  assert.equal(packageJson.scripts["release:check:strict"], "node scripts/quality-pipeline.mjs release:check:strict");
  assert.equal(packageJson.scripts["test:unit"], "node --test scripts/*.test.mjs && turbo run test:unit");

  for (const alias of ["dev:fresh", "dev:i18n", "dev:full:i18n", "lint", "test", "build"]) {
    assert.equal(typeof packageJson.scripts[alias], "string", alias);
  }
});

test("API test modes classify unit and integration suites explicitly", () => {
  assert.deepEqual(resolveApiTestMode(["--unit"]), {
    mode: "unit",
    testRegex: API_UNIT_TEST_REGEX,
    passthrough: []
  });
  assert.deepEqual(resolveApiTestMode(["--integration"]), {
    mode: "integration",
    testRegex: API_INTEGRATION_TEST_REGEX,
    passthrough: []
  });
  assert.throws(() => resolveApiTestMode(["--unit", "--integration"]), /either/);

  const unitTests = listApiTests(API_UNIT_TEST_REGEX);
  const integrationTests = listApiTests(API_INTEGRATION_TEST_REGEX);
  assert.ok(unitTests.length > 0);
  assert.ok(integrationTests.length > 0);
  for (const path of unitTests) {
    assert.match(path, /\.spec\.ts$/);
    assert.doesNotMatch(path, /\.integration\.spec\.ts$|\.e2e-spec\.ts$/);
  }
  for (const path of integrationTests) {
    assert.match(path, /\.integration\.spec\.ts$|\.e2e-spec\.ts$/);
  }
});

test("onboarding documentation exposes one canonical path", () => {
  const requiredDocuments = [
    "docs/README.md",
    "docs/START_HERE.md",
    "docs/development/COMMANDS.md",
    "docs/development/LOCAL_ENVIRONMENT.md",
    "docs/development/TROUBLESHOOTING.md",
    "docs/configuration/ENVIRONMENT_VARIABLES.md",
    "docs/governance/DEPENDENCY_UPDATES.md"
  ];
  for (const path of requiredDocuments) {
    assert.equal(existsSync(new URL(path, repositoryRoot)), true, path);
  }

  const startHere = readFileSync(new URL("docs/START_HERE.md", repositoryRoot), "utf8");
  for (const instruction of [
    "Desarrollar → pnpm start",
    "Validar rápido → pnpm check",
    "Validar integración → pnpm quality:gate",
    "Preparar release → pnpm release:check:strict"
  ]) {
    assert.match(startHere, new RegExp(instruction));
  }
});

test("Dependabot groups compatible updates and keeps majors separate", () => {
  const dependabot = readFileSync(new URL(".github/dependabot.yml", repositoryRoot), "utf8");
  const policy = readFileSync(new URL("docs/governance/DEPENDENCY_UPDATES.md", repositoryRoot), "utf8");
  assert.equal((dependabot.match(/interval: weekly/g) ?? []).length, 3);
  assert.equal((dependabot.match(/timezone: America\/Santiago/g) ?? []).length, 3);
  assert.equal((dependabot.match(/target-branch: main/g) ?? []).length, 3);
  assert.deepEqual(
    [...dependabot.matchAll(/open-pull-requests-limit: (\d+)/g)].map((match) => Number(match[1])),
    [5, 3, 3]
  );
  for (const group of [
    "runtime-minor-patch",
    "development-minor-patch",
    "actions-minor-patch",
    "images-minor-patch"
  ]) {
    const groupConfig = dependabotGroup(dependabot, group);
    assert.match(groupConfig, /update-types:\s*\n\s*- minor\s*\n\s*- patch/);
    assert.doesNotMatch(groupConfig, /- major/);
  }
  assert.doesNotMatch(dependabot, /update-types:\s*\n\s*- major/);
  assert.doesNotMatch(dependabot, /auto-?merge|automerge/i);
  assert.match(policy, /Frecuencia semanal/);
  assert.match(policy, /cinco para pnpm, tres para GitHub Actions/);
  assert.match(policy, /major separadas en todos los ecosistemas/);
  assert.match(policy, /Sin auto-merge/);
});

function runStart(args) {
  return spawnSync(process.execPath, ["scripts/start.mjs", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}

function listApiTests(testRegex) {
  const result = spawnSync(
    "pnpm",
    ["--dir", "apps/api", "exec", "jest", "--listTests", "--runInBand", "--testRegex", testRegex],
    { cwd: repositoryRoot, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split("\n").filter(Boolean);
}

function dependabotGroup(content, name) {
  const marker = `      ${name}:`;
  const start = content.indexOf(marker);
  assert.notEqual(start, -1, name);
  const remainder = content.slice(start + marker.length);
  const boundaries = [
    remainder.search(/\n {6}[a-z][a-z0-9-]+:\s*\n/),
    remainder.search(/\n {2}- package-ecosystem:/)
  ].filter((index) => index >= 0);
  const end = boundaries.length > 0 ? Math.min(...boundaries) : remainder.length;
  return remainder.slice(0, end);
}
