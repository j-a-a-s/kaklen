import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import {
  auditEnvironmentContract,
  discoverEnvironmentVariables,
  parseEnvironmentExample,
  readEnvironmentManifest,
  renderEnvironmentExample,
  renderEnvironmentMarkdown,
  validateEnvironmentManifest
} from "./environment-contract-core.mjs";

test("repository environment contract is complete and generated without drift", () => {
  const result = auditEnvironmentContract();
  assert.deepEqual(result.errors, []);
  assert.equal(result.manifest.variables.length, 88);
  assert.equal(result.manifest.variables.filter((item) => item.localExample).length, 11);
  assert.equal(result.manifest.variables.filter((item) => item.productionExample).length, 48);
});

test("discovery covers code, bracket access, package scripts, workflows, and Docker", () => {
  const root = mkdtempSync(join(tmpdir(), "kaklen-env-discovery-"));
  write(
    root,
    "src/config.mjs",
    ["process", ".env", ".CODE_VALUE; ", "env", "[\"BRACKET_VALUE\"];"].join("")
  );
  write(root, "package.json", JSON.stringify({ scripts: { start: "PACKAGE_VALUE=1 node app" } }));
  write(root, ".github/workflows/check.yml", "env:\n  WORKFLOW_VALUE: yes\n");
  write(root, "Dockerfile", "ENV DOCKER_VALUE=enabled\n");

  const result = discoverEnvironmentVariables(root);
  assert.deepEqual(
    [...result.variables.keys()].sort(),
    ["BRACKET_VALUE", "CODE_VALUE", "DOCKER_VALUE", "PACKAGE_VALUE", "WORKFLOW_VALUE"]
  );
  assert.deepEqual([...result.variables.get("DOCKER_VALUE").consumers], ["docker"]);
});

test("manifest rejects duplicate variables and undeclared dynamic keys", () => {
  const manifest = readEnvironmentManifest();
  const duplicate = structuredClone(manifest);
  duplicate.variables.push(structuredClone(duplicate.variables.at(-1)));
  assert.match(validateEnvironmentManifest(duplicate).join("\n"), /duplicate variable/);

  const invalidDynamic = structuredClone(manifest);
  invalidDynamic.dynamicAccess[0].variables.push("NOT_DOCUMENTED");
  assert.match(validateEnvironmentManifest(invalidDynamic).join("\n"), /unsupported value/);
});

test("production rendering leaves every secret empty and applies hardened fixed values", () => {
  const manifest = readEnvironmentManifest();
  const rendered = renderEnvironmentExample(manifest, "production");
  const parsed = parseEnvironmentExample(rendered);
  assert.deepEqual(parsed.errors, []);
  for (const variable of manifest.variables.filter((item) => item.secret && item.productionExample)) {
    assert.equal(parsed.values.get(variable.name), "", variable.name);
  }
  assert.equal(parsed.values.get("NODE_ENV"), "production");
  assert.equal(parsed.values.get("DATABASE_SSL"), "true");
  assert.equal(parsed.values.get("COOKIE_SECURE"), "true");
  assert.equal(parsed.values.get("SWAGGER_ENABLED"), "false");
  assert.match(parsed.values.get("APP_PUBLIC_URL"), /^https:\/\//);
});

test("environment examples reject duplicate assignments and Markdown includes all fields", () => {
  const parsed = parseEnvironmentExample("PORT=3000\nPORT=4000\n", "fixture.env");
  assert.match(parsed.errors.join("\n"), /duplicate PORT/);
  const markdown = renderEnvironmentMarkdown(readEnvironmentManifest());
  for (const heading of ["Runtime productivo", "Desarrollo local", "Testing", "CI e internas"]) {
    assert.match(markdown, new RegExp(`## ${heading}`));
  }
  assert.match(markdown, /\| Variable \| Alcance \| Ambientes \| Obligatoria \| Tipo \| Default \| Consumidores \| Descripción \|/);
});

function write(root, path, content) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content);
}
