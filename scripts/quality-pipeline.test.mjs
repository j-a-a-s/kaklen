import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  defineTask,
  QUALITY_PROFILES,
  QUALITY_TASKS,
  resolveProfile,
  resolveQualityEnvironment,
  runQualityPipeline,
  validateTaskGraph
} from "./quality-pipeline-core.mjs";

const requiredCiControls = [
  "commit-message",
  "environment-contract",
  "docs-contract",
  "governance",
  "architecture",
  "quality-scan",
  "secret-scan",
  "sast",
  "sbom",
  "dependency-audit",
  "db-validate",
  "migration-verification",
  "demo-seed",
  "demo-verify",
  "forms-audit",
  "lint",
  "test",
  "coverage",
  "build",
  "api-build-verification",
  "build-es",
  "build-en",
  "build-pt-BR",
  "i18n-server",
  "mail",
  "e2e",
  "accessibility",
  "docker-api",
  "scorecard"
];

test("each profile resolves every task key at most once", () => {
  for (const profileName of Object.keys(QUALITY_PROFILES)) {
    const keys = resolveProfile(profileName).tasks.map((task) => task.key);
    assert.equal(new Set(keys).size, keys.length, profileName);
  }
});

test("dependencies are resolved before dependants", () => {
  for (const profileName of Object.keys(QUALITY_PROFILES)) {
    const keys = resolveProfile(profileName).tasks.map((task) => task.key);
    const positions = new Map(keys.map((key, index) => [key, index]));
    for (const task of resolveProfile(profileName).tasks) {
      for (const dependency of task.dependencies) {
        assert.ok(positions.get(dependency) < positions.get(task.key), `${dependency} must precede ${task.key}`);
      }
    }
  }
});

test("required failure stops later tasks immediately", async () => {
  const { tasks, profiles } = fixtureGraph();
  const executed = [];
  const result = await runQualityPipeline({
    profile: "controlled",
    tasks,
    profiles,
    writeArtifact: false,
    execute: async (task) => {
      executed.push(task.key);
      return task.key === "second" ? { exitCode: 4, signal: null } : { exitCode: 0, signal: null };
    }
  });
  assert.deepEqual(executed, ["first", "second"]);
  assert.equal(result.artifact.tasks[2].status, "skipped");
});

test("task exit code is preserved", async () => {
  const { tasks, profiles } = fixtureGraph();
  const result = await runQualityPipeline({
    profile: "controlled",
    tasks,
    profiles,
    writeArtifact: false,
    execute: async (task) => ({ exitCode: task.key === "first" ? 17 : 0, signal: null })
  });
  assert.equal(result.artifact.tasks[0].exitCode, 17);
  assert.equal(result.failure?.key, "first");
});

test("task signal is preserved", async () => {
  const { tasks, profiles } = fixtureGraph();
  const result = await runQualityPipeline({
    profile: "controlled",
    tasks,
    profiles,
    writeArtifact: false,
    execute: async () => ({ exitCode: null, signal: "SIGTERM" })
  });
  assert.equal(result.artifact.tasks[0].signal, "SIGTERM");
  assert.match(result.failure?.cause ?? "", /SIGTERM/);
});

test("profiles select local and CI environments without nesting profiles", () => {
  assert.equal(resolveProfile("check").environment, "local");
  assert.equal(resolveProfile("quality:gate").environment, "local");
  assert.equal(resolveProfile("quality:gate:ci").environment, "ci");
  assert.ok(resolveProfile("release:check:strict").tasks.some((task) => task.key === "external-readiness"));
  for (const task of QUALITY_TASKS) {
    assert.equal(task.args.some((argument) => Object.hasOwn(QUALITY_PROFILES, argument)), false);
  }
  validateTaskGraph();
});

test("local profiles receive the documented database default while CI fails closed", () => {
  assert.equal(
    resolveQualityEnvironment("local", {}).DATABASE_URL,
    "postgresql://kaklen:kaklen_dev_password@localhost:5432/kaklen_dev?schema=public"
  );
  assert.equal(resolveQualityEnvironment("ci", {}).DATABASE_URL, undefined);
  assert.equal(
    resolveQualityEnvironment("local", { DATABASE_URL: "postgresql://custom/database" }).DATABASE_URL,
    "postgresql://custom/database"
  );
});

test("check is the fast service-free workspace profile", () => {
  const keys = resolveProfile("check").tasks.map((task) => task.key);
  assert.deepEqual(keys, [
    "environment-contract",
    "docs-contract",
    "governance",
    "architecture",
    "quality-scan",
    "forms-audit",
    "pdf-money-parity",
    "prisma-generate",
    "lint",
    "test-unit"
  ]);
  for (const excluded of [
    "local-services",
    "test",
    "db-migrate",
    "e2e",
    "build-es",
    "build-en",
    "build-pt-BR",
    "mutation-critical",
    "external-readiness",
    "docker-api"
  ]) {
    assert.equal(keys.includes(excluded), false, excluded);
  }
});

test("quality gate does not invoke release check", () => {
  for (const task of resolveProfile("quality:gate").tasks) {
    assert.doesNotMatch(`${task.command} ${task.args.join(" ")}`, /release:check/);
  }
});

test("CI profile contains every required canonical control", () => {
  const keys = new Set(resolveProfile("quality:gate:ci").tasks.map((task) => task.key));
  for (const key of requiredCiControls) assert.equal(keys.has(key), true, key);
});

test("failure artifacts redact database URLs and credential values", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kaklen-quality-"));
  const artifactPath = join(directory, "quality.json");
  const { tasks, profiles } = fixtureGraph();
  await runQualityPipeline({
    profile: "controlled",
    tasks,
    profiles,
    artifactPath,
    execute: async () => ({
      exitCode: 1,
      signal: null,
      cause: "postgresql://user:super-secret@localhost/db password=hunter2 token=abc123"
    })
  });
  const artifact = readFileSync(artifactPath, "utf8");
  assert.doesNotMatch(artifact, /super-secret|hunter2|abc123/);
  assert.match(artifact, /REDACTED/);
});

function fixtureGraph() {
  const tasks = [
    defineTask("first", "First", "node", ["first"], [], ["ci"], 1000),
    defineTask("second", "Second", "node", ["second"], ["first"], ["ci"], 1000),
    defineTask("third", "Third", "node", ["third"], ["second"], ["ci"], 1000)
  ];
  return { tasks, profiles: { controlled: { environment: "ci", tasks: ["third"] } } };
}
