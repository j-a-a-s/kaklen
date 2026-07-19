import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
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

  for (const alias of ["dev:fresh", "dev:i18n", "dev:full:i18n", "lint", "test", "build"]) {
    assert.equal(typeof packageJson.scripts[alias], "string", alias);
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

test("canonical documentation contains no broken local links", () => {
  const documents = [
    "README.md",
    "INSTALL.md",
    "CONTRIBUTING.md",
    "docs/README.md",
    "docs/START_HERE.md",
    "docs/development/COMMANDS.md",
    "docs/development/LOCAL_ENVIRONMENT.md",
    "docs/development/TROUBLESHOOTING.md",
    "docs/configuration/ENVIRONMENT_VARIABLES.md",
    "docs/governance/DEPENDENCY_UPDATES.md"
  ];
  for (const document of documents) {
    const documentUrl = new URL(document, repositoryRoot);
    const markdown = readFileSync(documentUrl, "utf8");
    for (const match of markdown.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)) {
      const target = match[1].split("#")[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      assert.equal(existsSync(new URL(target, documentUrl)), true, `${document} -> ${target}`);
    }
  }
});

test("every public local environment variable is documented", () => {
  const example = readFileSync(new URL(".env.example", repositoryRoot), "utf8");
  const documentation = readFileSync(
    new URL("docs/configuration/ENVIRONMENT_VARIABLES.md", repositoryRoot),
    "utf8"
  );
  const keys = example
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => line.slice(0, line.indexOf("=")));
  for (const key of keys) {
    assert.equal(documentation.includes(`\`${key}\``), true, key);
  }
});

test("Dependabot groups compatible updates and keeps majors separate", () => {
  const dependabot = readFileSync(new URL(".github/dependabot.yml", repositoryRoot), "utf8");
  assert.equal((dependabot.match(/timezone: America\/Santiago/g) ?? []).length, 3);
  assert.equal((dependabot.match(/target-branch: main/g) ?? []).length, 3);
  assert.match(dependabot, /runtime-minor-patch:/);
  assert.match(dependabot, /development-minor-patch:/);
  assert.doesNotMatch(dependabot, /update-types:\s*\n\s*- major/);
});

function runStart(args) {
  return spawnSync(process.execPath, ["scripts/start.mjs", ...args], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
}
