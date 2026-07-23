import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  defineTask,
  executeQualityTask,
  QUALITY_PROFILES,
  QUALITY_TASKS,
  resolveProfile,
  resolveQualityEnvironment,
  runQualityPipeline,
  validateTaskGraph
} from "./quality-pipeline-core.mjs";
import { cleanupQualityServices } from "./quality-services-core.mjs";

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
  "docker-web",
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

test("quality task returns an exit code on success", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kaklen-quality-exit-"));
  const task = defineTask(
    "exit-fixture",
    "Exit fixture",
    process.execPath,
    ["-e", "process.exit(0)"],
    [],
    ["ci"],
    2_000,
  );
  const result = await executeQualityTask(task, process.env, {
    forceSettleMs: 500,
    gracePeriodMs: 100,
    logDirectory: directory,
  });

  assert.equal(result.exitCode, 0);
  assert.equal(result.signal, null);
  assert.equal(result.cleanupExecuted, true);
});

test("quality task timeout fails instead of waiting indefinitely", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kaklen-quality-timeout-"));
  const task = defineTask(
    "timeout-fixture",
    "Timeout fixture",
    process.execPath,
    ["-e", 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'],
    [],
    ["ci"],
    100,
  );
  const result = await executeQualityTask(task, process.env, {
    forceSettleMs: 500,
    gracePeriodMs: 100,
    logDirectory: directory,
  });

  assert.equal(result.exitCode, 124);
  assert.equal(result.timedOut, true);
  assert.equal(result.cleanupExecuted, true);
});

test("pipeline cleanup runs after a required task failure", async () => {
  const { tasks, profiles } = fixtureGraph();
  let cleanupCalls = 0;
  const result = await runQualityPipeline({
    cleanup: async () => {
      cleanupCalls += 1;
      return { removedServices: [] };
    },
    execute: async () => ({ exitCode: 9, signal: null }),
    profile: "controlled",
    profiles,
    tasks,
    writeArtifact: false,
  });

  assert.equal(result.failure?.exitCode, 9);
  assert.equal(cleanupCalls, 1);
  assert.equal(result.artifact.cleanup.status, "passed");
});

test("quality service cleanup removes only containers owned by the run", async () => {
  const directory = mkdtempSync(join(tmpdir(), "kaklen-quality-services-"));
  const statePath = join(directory, "state.json");
  writeFileSync(statePath, JSON.stringify({
    containerIds: { postgres: "container-1" },
    runId: "quality-run",
    startedServices: ["postgres"],
  }));
  const calls = [];

  const result = await cleanupQualityServices({
    env: {},
    expectedRunId: "quality-run",
    readContainerId: () => "container-1",
    run: async (command, args) => calls.push([command, ...args]),
    statePath,
  });

  assert.deepEqual(result.removedServices, ["postgres"]);
  assert.deepEqual(calls, [["docker", "compose", "rm", "--force", "--stop", "postgres"]]);
  assert.equal(existsSync(statePath), false);
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
    "docker-api",
    "docker-web"
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

test("Docker controls allow a cold dependency install and localized builds", () => {
  for (const key of ["docker-api", "docker-web"]) {
    const task = QUALITY_TASKS.find((candidate) => candidate.key === key);
    assert.ok(task, key);
    assert.ok(task.timeout >= 900_000, `${key} must allow at least 15 minutes`);
  }
});

test("coverage mode invalidates and restores the cached test artifact", () => {
  const turbo = JSON.parse(readFileSync("turbo.json", "utf8"));
  assert.ok(turbo.tasks["@kaklen/api#test"].env.includes("API_TEST_WITH_COVERAGE"));
  assert.ok(turbo.tasks["@kaklen/api#test"].outputs.includes("coverage/**"));
  assert.deepEqual(turbo.tasks.test.outputs, []);
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
