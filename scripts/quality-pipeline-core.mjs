import { spawn } from "node:child_process";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const BOTH = Object.freeze(["local", "ci"]);

export const QUALITY_TASKS = Object.freeze([
  defineTask("local-services", "Local services", "node", ["scripts/ensure-quality-services.mjs"], [], ["local"], 90_000),
  defineTask("commit-message", "Conventional commit message", "pnpm", ["commit:verify"], [], BOTH, 30_000),
  defineTask("environment-contract", "Environment contract", "pnpm", ["env:verify"], [], BOTH, 60_000),
  defineTask("docs-contract", "Documentation contract", "pnpm", ["docs:verify"], [], BOTH, 60_000),
  defineTask("governance", "Governance contract", "pnpm", ["governance:verify"], ["docs-contract"], BOTH, 60_000),
  defineTask("architecture", "Architecture check", "pnpm", ["architecture:check"], [], BOTH, 60_000),
  defineTask("quality-scan", "Quality scan", "pnpm", ["quality:scan"], ["architecture"], BOTH, 60_000),
  defineTask("secret-scan", "Secret scan", "pnpm", ["security:scan"], [], BOTH, 60_000),
  defineTask("sast", "Static security analysis", "pnpm", ["security:sast"], ["secret-scan"], BOTH, 60_000),
  defineTask("sbom", "Software bill of materials", "pnpm", ["security:sbom"], [], BOTH, 90_000, ["artifacts/sbom.cdx.json"]),
  defineTask("dependency-audit", "Dependency audit", "pnpm", ["dependency:audit"], [], BOTH, 90_000),
  defineTask("prisma-generate", "Prisma Client", "pnpm", ["prisma:generate"], [], BOTH, 120_000),
  defineTask("db-migrate", "Database migrations", "pnpm", ["exec", "prisma", "migrate", "deploy"], ["prisma-generate"], BOTH, 180_000),
  defineTask("db-validate", "Database validation", "pnpm", ["db:validate"], ["db-migrate"], BOTH, 120_000, [], true, { DB_SKIP_PRISMA_GENERATE: "true" }),
  defineTask("migration-verification", "Clean migration verification", "pnpm", ["db:verify:migrations"], ["db-migrate"], BOTH, 300_000, [], true, {
    MIGRATION_REUSE_PRISMA_CLIENT: "true",
    MIGRATION_REUSE_DEMO_VERIFICATION: "true"
  }),
  defineTask("demo-seed", "Deterministic demo seed", "pnpm", ["db:seed:demo"], ["db-migrate"], BOTH, 180_000),
  defineTask("demo-verify", "Deterministic demo verification", "pnpm", ["db:verify:demo"], ["demo-seed"], BOTH, 120_000),
  defineTask("db-money", "CLP money precision", "pnpm", ["db:verify:money"], ["demo-seed"], BOTH, 120_000),
  defineTask("forms-audit", "Form standardization", "pnpm", ["forms:audit"], [], BOTH, 90_000, ["artifacts/forms-audit.json"]),
  defineTask("pdf-money-parity", "PDF money parity", "pnpm", ["pdf:verify-money"], [], BOTH, 60_000),
  defineTask("lint", "Workspace lint", "pnpm", ["lint"], ["forms-audit", "pdf-money-parity"], BOTH, 180_000),
  defineTask("test-unit", "Workspace unit tests", "pnpm", ["test:unit"], ["lint"], BOTH, 360_000),
  defineTask("test", "Workspace tests with API coverage", "pnpm", ["test"], ["lint"], BOTH, 360_000, [], true, {
    API_TEST_WITH_COVERAGE: "true"
  }),
  defineTask("coverage", "Coverage thresholds", "pnpm", ["test:coverage"], ["test"], BOTH, 60_000, ["apps/api/coverage/coverage-summary.json"], true, {
    COVERAGE_REUSE: "true"
  }),
  defineTask("build", "Workspace build", "pnpm", ["build"], ["coverage"], BOTH, 300_000),
  defineTask("api-build-verification", "API build verification", "pnpm", ["verify:api-build"], ["build"], BOTH, 120_000),
  defineTask("build-es", "Localized build es", "pnpm", ["--filter", "@kaklen/web", "build:es"], ["build"], BOTH, 240_000),
  defineTask("build-en", "Localized build en", "pnpm", ["--filter", "@kaklen/web", "build:en"], ["build"], BOTH, 240_000),
  defineTask("build-pt-BR", "Localized build pt-BR", "pnpm", ["--filter", "@kaklen/web", "build:pt-BR"], ["build"], BOTH, 240_000),
  defineTask("i18n-server", "Localized server verification", "pnpm", ["verify:i18n-server"], ["build-es", "build-en", "build-pt-BR"], BOTH, 120_000, [], true, { I18N_SKIP_BUILD: "true" }),
  defineTask("mail", "SMTP verification", "pnpm", ["mail:verify"], ["build", "db-validate"], BOTH, 120_000, [], true, {
    MAIL_REUSE_CONFIG_BUILD: "true"
  }),
  defineTask("e2e", "End-to-end suite", "pnpm", ["e2e"], ["api-build-verification", "i18n-server", "demo-verify", "mail"], BOTH, 600_000, ["playwright-report", "test-results", "artifacts/e2e-result.json"], true, { E2E_REUSE_ARTIFACTS: "true" }),
  defineTask("accessibility", "Accessibility verification", "pnpm", ["accessibility:test"], ["e2e"], BOTH, 30_000, ["artifacts/e2e-result.json"], true, {
    ACCESSIBILITY_REUSE_E2E: "true"
  }),
  defineTask("docker-api", "API Docker image", "docker", ["build", "--platform", "linux/amd64", "-f", "apps/api/Dockerfile", "-t", "kaklen-api:quality", "."], ["build"], BOTH, 600_000),
  defineTask("mutation-critical", "Critical mutation tests", "pnpm", ["test:mutation:critical"], ["coverage"], BOTH, 180_000),
  defineTask("external-readiness", "External production readiness", "node", ["scripts/verify-external-readiness.mjs"], [], BOTH, 30_000),
  defineTask(
    "scorecard",
    "Technical scorecard",
    "pnpm",
    ["scorecard:verify"],
    ["coverage", "forms-audit", "migration-verification", "sast", "i18n-server", "accessibility", "docker-api"],
    BOTH,
    60_000,
    ["artifacts/technical-scorecard.json", "docs/release/TECHNICAL_SCORECARD.md"]
  )
]);

const COMMON_PROFILE = [
  "commit-message", "environment-contract", "docs-contract", "governance", "architecture", "quality-scan", "secret-scan", "sast", "sbom", "dependency-audit",
  "prisma-generate", "db-migrate", "db-validate", "migration-verification", "demo-seed", "demo-verify", "db-money",
  "forms-audit", "pdf-money-parity", "lint", "test", "coverage", "build", "api-build-verification",
  "build-es", "build-en", "build-pt-BR", "i18n-server", "mail", "e2e", "accessibility", "docker-api", "scorecard"
];

export const QUALITY_PROFILES = Object.freeze({
  check: {
    environment: "local",
    tasks: ["environment-contract", "docs-contract", "governance", "architecture", "quality-scan", "forms-audit", "pdf-money-parity", "lint", "test-unit"]
  },
  "quality:gate": { environment: "local", tasks: ["local-services", ...COMMON_PROFILE] },
  "quality:gate:ci": { environment: "ci", tasks: COMMON_PROFILE },
  "release:check": { environment: "local", tasks: ["local-services", ...COMMON_PROFILE] },
  "release:check:strict": {
    environment: "local",
    tasks: ["local-services", ...COMMON_PROFILE.filter((key) => key !== "scorecard"), "mutation-critical", "external-readiness", "scorecard"]
  }
});

export function resolveProfile(profileName, profiles = QUALITY_PROFILES, tasks = QUALITY_TASKS) {
  const profile = profiles[profileName];
  if (!profile) throw new Error(`Unknown quality profile: ${profileName}`);
  validateTaskGraph(tasks, profiles);
  const byKey = new Map(tasks.map((task) => [task.key, task]));
  const visiting = new Set();
  const visited = new Set();
  const ordered = [];

  const include = (key) => {
    if (visited.has(key)) return;
    if (visiting.has(key)) throw new Error(`Quality task dependency cycle at ${key}`);
    const task = byKey.get(key);
    if (!task) throw new Error(`Unknown quality task: ${key}`);
    if (!task.environments.includes(profile.environment)) throw new Error(`${key} is not allowed in ${profile.environment}`);
    visiting.add(key);
    task.dependencies.forEach((dependency) => {
      include(dependency);
    });
    visiting.delete(key);
    visited.add(key);
    ordered.push(task);
  };

  profile.tasks.forEach(include);
  if (ordered.length !== new Set(ordered.map((task) => task.key)).size) throw new Error("Quality profile contains duplicate task keys");
  return { ...profile, name: profileName, tasks: ordered };
}

export function validateTaskGraph(tasks = QUALITY_TASKS, profiles = QUALITY_PROFILES) {
  const keys = tasks.map((task) => task.key);
  if (new Set(keys).size !== keys.length) throw new Error("Quality graph contains duplicate task keys");
  const keySet = new Set(keys);
  const profileNames = new Set(Object.keys(profiles));
  for (const task of tasks) {
    if (!task.key || !task.label || !task.command || !Array.isArray(task.args)) {
      throw new Error("Quality task descriptor is incomplete");
    }
    if (!Number.isInteger(task.timeout) || task.timeout <= 0) throw new Error(`${task.key} has an invalid timeout`);
    for (const dependency of task.dependencies) {
      if (!keySet.has(dependency)) throw new Error(`${task.key} depends on unknown task ${dependency}`);
    }
    if (task.args.some((argument) => profileNames.has(argument))) {
      throw new Error(`${task.key} cannot invoke a quality profile`);
    }
  }
  for (const [name, profile] of Object.entries(profiles)) {
    if (!Array.isArray(profile.tasks) || !["local", "ci"].includes(profile.environment)) {
      throw new Error(`Quality profile ${name} is invalid`);
    }
    if (new Set(profile.tasks).size !== profile.tasks.length) throw new Error(`${name} contains duplicate task keys`);
    for (const key of profile.tasks) {
      if (!keySet.has(key)) throw new Error(`${name} selects unknown task ${key}`);
    }
  }
}

export async function runQualityPipeline(options) {
  const profile = resolveProfile(options.profile, options.profiles, options.tasks);
  const execute = options.execute ?? executeTask;
  const now = options.now ?? (() => Date.now());
  const isoNow = options.isoNow ?? (() => new Date().toISOString());
  const artifactPath = resolve(options.artifactPath ?? "artifacts/quality-gate.json");
  const startedMs = now();
  const artifact = {
    profile: profile.name,
    status: "running",
    startedAt: isoNow(),
    finishedAt: null,
    durationMs: 0,
    commitSha: options.commitSha ?? currentCommitSha(),
    tasks: profile.tasks.map((task) => ({ key: task.key, status: "pending", durationMs: 0, exitCode: null, signal: null }))
  };
  const persist = () => {
    if (options.writeArtifact === false) return;
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);
  };
  persist();

  for (let index = 0; index < profile.tasks.length; index += 1) {
    const task = profile.tasks[index];
    const record = artifact.tasks[index];
    record.status = "running";
    persist();
    options.onTaskStart?.(task);
    const taskStarted = now();
    const result = await execute(task, { ...process.env, ...task.env });
    record.durationMs = Math.max(0, now() - taskStarted);
    record.exitCode = result.exitCode ?? null;
    record.signal = result.signal ?? null;
    record.status = result.exitCode === 0 && !result.signal ? "passed" : "failed";
    options.onTaskFinish?.(task, record);

    if (record.status === "failed" && task.required) {
      for (let pending = index + 1; pending < artifact.tasks.length; pending += 1) artifact.tasks[pending].status = "skipped";
      artifact.status = "failed";
      artifact.failure = { key: task.key, cause: sanitizeCause(result.cause ?? failureCause(record)) };
      artifact.finishedAt = isoNow();
      artifact.durationMs = Math.max(0, now() - startedMs);
      persist();
      return { artifact, failure: artifact.failure };
    }
    persist();
  }

  artifact.status = "passed";
  artifact.finishedAt = isoNow();
  artifact.durationMs = Math.max(0, now() - startedMs);
  persist();
  return { artifact, failure: null };
}

export function defineTask(key, label, command, args, dependencies, environments, timeout, artifacts = [], required = true, env = {}) {
  return Object.freeze({ key, label, command, args, dependencies, environments, timeout, artifacts, required, env });
}

function executeTask(task, env) {
  return new Promise((resolveTask) => {
    let settled = false;
    let timedOut = false;
    const child = spawn(task.command, task.args, { stdio: "inherit", shell: false, env });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
    }, task.timeout);
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveTask(result);
    };
    child.once("error", (error) => finish({ exitCode: 1, signal: null, cause: error.message }));
    child.once("exit", (code, signal) => finish({
      exitCode: code,
      signal,
      cause: timedOut ? `timeout after ${task.timeout} ms` : signal ? `signal ${signal}` : `exit ${code ?? 1}`
    }));
  });
}

function currentCommitSha() {
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function failureCause(record) {
  return record.signal ? `signal ${record.signal}` : `exit ${record.exitCode ?? 1}`;
}

export function sanitizeCause(value) {
  return String(value)
    .replace(/(?:postgres(?:ql)?|redis):\/\/[^\s]+/gi, "[REDACTED_URL]")
    .replace(/((?:password|secret|token)=)[^\s]+/gi, "$1[REDACTED]")
    .slice(0, 500);
}
