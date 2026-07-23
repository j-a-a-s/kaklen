import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createConnection } from "node:net";
import { hostname } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabase, loadLocalEnv, readDatabaseUrl } from "./local-db-utils.mjs";
import { isProcessAlive, runSupervisedProcess } from "./process-supervisor.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const QUALITY_STATE_VERSION = 1;
const QUALITY_COMPOSE_PROJECT = "kaklen";
const RUN_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/;
const CONTAINER_ID_PATTERN = /^[a-f0-9]{12,64}$/;
const COMPOSE_PROJECT_PATTERN = /^[a-z0-9][a-z0-9_-]{0,62}$/;
const QUALITY_SERVICE_NAMES = Object.freeze(["postgres", "redis", "mailpit"]);
const QUALITY_SERVICE_SET = new Set(QUALITY_SERVICE_NAMES);

export const QUALITY_SERVICES_DIRECTORY = resolve(
  REPO_ROOT,
  "artifacts/quality-services",
);
export const QUALITY_GATE_LOCK_PATH = resolve(
  QUALITY_SERVICES_DIRECTORY,
  "quality-gate.lock",
);

export function createQualityRunId() {
  return validateQualityRunId(
    `quality-${process.pid}-${Date.now()}-${randomBytes(6).toString("hex")}`,
  );
}

export function resolveQualityServicesStatePath(runId) {
  const safeRunId = validateQualityRunId(runId);
  const statePath = resolve(QUALITY_SERVICES_DIRECTORY, `${safeRunId}.json`);
  if (dirname(statePath) !== QUALITY_SERVICES_DIRECTORY) {
    throw new Error("Quality services state path escaped its artifact directory.");
  }
  return statePath;
}

export function acquireQualityGateLock(options = {}) {
  const runId = validateQualityRunId(options.runId);
  const ownerPid = validatePid(options.pid ?? process.pid, "Quality gate lock pid");
  const ownerHostname = validateHostname(options.hostname ?? hostname());
  const startedAt = validateTimestamp(
    options.startedAt ?? new Date().toISOString(),
    "Quality gate lock startedAt",
  );
  const lockPath = resolve(options.lockPath ?? QUALITY_GATE_LOCK_PATH);
  const recoveryLockPath = `${lockPath}.recovery`;
  const isPidAlive = options.isPidAlive ?? isProcessAlive;
  const onDiagnostic = options.onDiagnostic ?? (() => {});
  const record = {
    runId,
    pid: ownerPid,
    startedAt,
    hostname: ownerHostname,
  };
  mkdirSync(dirname(lockPath), { recursive: true });

  const staleLocks = [];
  for (let attempt = 0; attempt < 8; attempt += 1) {
    recoverAbandonedLockCoordinator({
      isPidAlive,
      onDiagnostic,
      ownerHostname,
      recoveryLockPath,
    });
    try {
      createExclusiveJson(lockPath, record);
      return createQualityGateLease({ lockPath, record, staleLocks });
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
    }

    const existing = readQualityGateLock({ lockPath });
    assertRecoverableLock(existing, { isPidAlive, ownerHostname });
    try {
      createExclusiveJson(recoveryLockPath, record);
    } catch (error) {
      if (error?.code === "EEXIST") continue;
      throw error;
    }

    let acquiredLease = null;
    let acquisitionError = null;
    try {
      if (existsSync(lockPath)) {
        const current = readQualityGateLock({ lockPath });
        assertRecoverableLock(current, { isPidAlive, ownerHostname });
        const stalePath = `${lockPath}.stale-${Date.now()}-${randomBytes(4).toString("hex")}`;
        renameSync(lockPath, stalePath);
        staleLocks.push(stalePath);
        onDiagnostic({
          phase: "quality:stale-lock",
          runId: current.runId,
          pid: current.pid,
          stalePath,
        });
      }
      createExclusiveJson(lockPath, record);
      acquiredLease = createQualityGateLease({ lockPath, record, staleLocks });
    } catch (error) {
      acquisitionError = error;
    }

    let coordinatorReleaseError = null;
    try {
      releaseLockFile({
        expectedHostname: ownerHostname,
        expectedPid: ownerPid,
        expectedRunId: runId,
        lockPath: recoveryLockPath,
        label: "Quality Gate recovery lock",
      });
    } catch (error) {
      coordinatorReleaseError = error;
    }

    if (acquisitionError && coordinatorReleaseError) {
      throw new AggregateError(
        [acquisitionError, coordinatorReleaseError],
        "Stale Quality Gate lock recovery and coordinator release both failed.",
      );
    }
    if (acquisitionError) throw acquisitionError;
    if (coordinatorReleaseError) {
      let rollbackError = null;
      try {
        acquiredLease.release();
      } catch (error) {
        rollbackError = error;
      }
      if (rollbackError) {
        throw new AggregateError(
          [coordinatorReleaseError, rollbackError],
          "Quality Gate recovery coordinator release failed and the new lock could not be rolled back.",
        );
      }
      throw coordinatorReleaseError;
    }
    return acquiredLease;
  }

  throw new Error("Quality Gate lock could not be acquired after stale-lock recovery.");
}

export async function withQualityGateLock(options, callback) {
  const lease = acquireQualityGateLock(options);
  const releaseStartedAt = Date.now();
  let result;
  let primaryError = null;
  try {
    result = await callback(lease);
  } catch (error) {
    primaryError = error;
  }

  let releaseError = null;
  try {
    const release = lease.release();
    options.onRelease?.({
      durationMs: Math.max(0, Date.now() - releaseStartedAt),
      runId: lease.runId,
      status: release.status,
    });
  } catch (error) {
    releaseError = error;
  }

  if (primaryError && releaseError) {
    throw new AggregateError(
      [primaryError, releaseError],
      "Quality Gate failed and its lock could not be released.",
    );
  }
  if (primaryError) throw primaryError;
  if (releaseError) throw releaseError;
  return result;
}

export function readQualityGateLock(options = {}) {
  const lockPath = resolve(options.lockPath ?? QUALITY_GATE_LOCK_PATH);
  if (!existsSync(lockPath)) {
    throw new Error(`Quality Gate lock does not exist at ${lockPath}.`);
  }
  const lock = parseJsonFile(lockPath, "Quality Gate lock");
  validateQualityGateLock(lock);
  if (options.expectedRunId && lock.runId !== validateQualityRunId(options.expectedRunId)) {
    throw new Error(
      `Quality Gate lock belongs to run ${lock.runId}, expected ${options.expectedRunId}.`,
    );
  }
  return lock;
}

export function releaseQualityGateLock(options = {}) {
  const lockPath = resolve(options.lockPath ?? QUALITY_GATE_LOCK_PATH);
  return releaseLockFile({
    expectedHostname: options.expectedHostname,
    expectedPid: options.expectedPid,
    expectedRunId: options.expectedRunId,
    lockPath,
    label: "Quality Gate lock",
  });
}

export async function ensureQualityServices(options = {}) {
  const env = options.env ?? loadLocalEnv();
  const runId = validateQualityRunId(options.runId ?? env.QUALITY_RUN_ID);
  const owner = options.owner ?? readQualityGateLock({
    expectedRunId: runId,
    lockPath: options.lockPath,
  });
  validateQualityGateLock(owner);
  if (owner.runId !== runId) {
    throw new Error(`Quality service owner ${owner.runId} does not match run ${runId}.`);
  }

  const statePath = resolveRunStatePath(runId, options.statePath);
  const databaseUrl = readDatabaseUrl(env);
  const redisPort = positivePort(env.REDIS_PORT, 6379, "Redis");
  const smtpPort = positivePort(env.MAILPIT_SMTP_PORT, 1025, "Mailpit SMTP");
  const mailpitPort = positivePort(env.MAILPIT_WEB_PORT, 8025, "Mailpit web");
  const run = options.run ?? runForeground;
  const readContainerId = options.readContainerId ?? composeContainerId;
  const checkDatabaseConnection = options.checkDatabase ?? checkDatabase;
  const checkTcp = options.tcpAvailable ?? tcpAvailable;
  const missing = [];
  const beforeIds = {};
  const containers = {};

  for (const service of QUALITY_SERVICE_NAMES) {
    const id = normalizeContainerId(readContainerId(service, env));
    beforeIds[service] = id;
    if (id) {
      containers[service] = {
        id,
        owned: false,
        existedBefore: true,
      };
    }
  }

  const initialDatabase = await checkDatabaseConnection(databaseUrl);
  if (!initialDatabase.ok) {
    if (!["unavailable", "timeout"].includes(initialDatabase.type)) {
      throw new Error(initialDatabase.message);
    }
    missing.push("postgres");
  }
  if (!(await checkTcp(redisPort))) missing.push("redis");
  if (!(await checkTcp(smtpPort)) || !(await checkTcp(mailpitPort))) {
    missing.push("mailpit");
  }

  const state = {
    version: QUALITY_STATE_VERSION,
    runId,
    pid: owner.pid,
    startedAt: owner.startedAt,
    hostname: owner.hostname,
    composeProject: QUALITY_COMPOSE_PROJECT,
    ownedServices: [],
    containers,
  };
  validateQualityServicesState(state);
  persistState(statePath, state, { exclusive: true });

  if (missing.length > 0) {
    console.log(`Iniciando servicios faltantes: ${missing.join(", ")}`);
    let startError = null;
    try {
      await run(
        "docker",
        ["compose", "--project-name", QUALITY_COMPOSE_PROJECT, "up", "-d", ...missing],
        env,
      );
    } catch (error) {
      startError = error;
    }

    for (const service of missing) {
      const id = normalizeContainerId(readContainerId(service, env));
      if (!id && !startError) {
        throw new Error(`Docker Compose did not expose a container for ${service}.`);
      }
      if (!id) continue;
      const existedBefore = Boolean(beforeIds[service]);
      state.containers[service] = {
        id,
        owned: !existedBefore,
        existedBefore,
      };
    }
    state.ownedServices = QUALITY_SERVICE_NAMES.filter(
      (service) => state.containers[service]?.owned === true,
    );
    validateQualityServicesState(state);
    persistState(statePath, state);
    if (startError) throw startError;
  }

  await waitFor(
    async () => (await checkDatabaseConnection(databaseUrl)).ok,
    "PostgreSQL",
    60_000,
  );
  await waitFor(() => checkTcp(redisPort), "Redis", 30_000);
  await waitFor(() => checkTcp(smtpPort), "Mailpit SMTP", 30_000);
  await waitFor(() => checkTcp(mailpitPort), "Mailpit web", 30_000);
  console.log("PostgreSQL, Redis y Mailpit disponibles");
  return state;
}

export async function cleanupQualityServices(options = {}) {
  const expectedRunId = validateQualityRunId(options.expectedRunId);
  const statePath = resolveRunStatePath(expectedRunId, options.statePath);
  if (!existsSync(statePath)) {
    return {
      removedContainerIds: [],
      removedServices: [],
      status: "not-needed",
    };
  }

  const state = readQualityServicesState(statePath);
  if (state.runId !== expectedRunId) {
    throw new Error(
      `Quality service state belongs to run ${state.runId}, expected ${expectedRunId}.`,
    );
  }

  const env = options.env ?? process.env;
  const readContainerId = options.readContainerId ?? composeContainerId;
  const removable = [];
  for (const service of state.ownedServices) {
    const ownership = state.containers[service];
    if (!ownership?.owned || ownership.existedBefore) {
      throw new Error(`Invalid owned-container state for ${service}.`);
    }
    const currentId = normalizeContainerId(readContainerId(service, env));
    if (!currentId) continue;
    if (currentId !== ownership.id) {
      throw new Error(
        `Refusing to remove ${service}: container ownership changed after quality run ${state.runId}.`,
      );
    }
    removable.push({ service, id: ownership.id });
  }

  if (removable.length > 0) {
    const run = options.run ?? runCleanupCommand;
    await run("docker", ["rm", "--force", ...removable.map(({ id }) => id)], env);
    for (const { service, id } of removable) {
      const currentId = normalizeContainerId(readContainerId(service, env));
      if (currentId === id) {
        throw new Error(`Docker cleanup did not remove owned container ${id}.`);
      }
    }
  }

  rmSync(statePath);
  return {
    removedContainerIds: removable.map(({ id }) => id),
    removedServices: removable.map(({ service }) => service),
    status: "passed",
  };
}

export async function recoverStaleQualityServices(options = {}) {
  const lease = options.activeLease;
  if (!lease) throw new Error("An active Quality Gate lease is required for stale cleanup.");
  assertQualityGateLease(lease);
  const stateDirectory = resolve(options.stateDirectory ?? QUALITY_SERVICES_DIRECTORY);
  const isPidAlive = options.isPidAlive ?? isProcessAlive;
  const currentHostname = validateHostname(options.hostname ?? hostname());
  const onDiagnostic = options.onDiagnostic ?? (() => {});
  mkdirSync(stateDirectory, { recursive: true });

  const recoveredRuns = [];
  const removedServices = [];
  for (const name of readdirSync(stateDirectory).sort()) {
    if (!name.endsWith(".json")) continue;
    const runId = name.slice(0, -5);
    validateQualityRunId(runId);
    if (runId === lease.runId) continue;
    const statePath = resolve(stateDirectory, name);
    if (dirname(statePath) !== stateDirectory) {
      throw new Error("Stale quality state escaped its artifact directory.");
    }
    const state = readQualityServicesState(statePath);
    if (state.hostname !== currentHostname) {
      throw new Error(
        `Quality state ${state.runId} belongs to host ${state.hostname}; refusing stale cleanup.`,
      );
    }
    if (isPidAlive(state.pid)) {
      throw new Error(
        `Quality state ${state.runId} still has an active owner pid ${state.pid}.`,
      );
    }
    const result = await cleanupQualityServices({
      env: options.env,
      expectedRunId: state.runId,
      readContainerId: options.readContainerId,
      run: options.run,
      statePath,
    });
    recoveredRuns.push(state.runId);
    removedServices.push(...result.removedServices);
    onDiagnostic({
      phase: "quality:stale-services",
      runId: state.runId,
      removedServices: result.removedServices,
    });
  }
  return { recoveredRuns, removedServices, status: "passed" };
}

export function readQualityServicesState(statePath) {
  const state = parseJsonFile(resolve(statePath), "Quality services state");
  validateQualityServicesState(state);
  return state;
}

export function validateQualityServicesState(state) {
  assertPlainObject(state, "Quality services state");
  assertExactKeys(
    state,
    [
      "version",
      "runId",
      "pid",
      "startedAt",
      "hostname",
      "composeProject",
      "ownedServices",
      "containers",
    ],
    "Quality services state",
  );
  if (state.version !== QUALITY_STATE_VERSION) {
    throw new Error(`Unsupported quality services state version ${String(state.version)}.`);
  }
  validateQualityRunId(state.runId);
  validatePid(state.pid, "Quality services state pid");
  validateTimestamp(state.startedAt, "Quality services state startedAt");
  validateHostname(state.hostname);
  if (
    typeof state.composeProject !== "string"
    || !COMPOSE_PROJECT_PATTERN.test(state.composeProject)
  ) {
    throw new Error("Quality services composeProject is invalid.");
  }
  if (!Array.isArray(state.ownedServices)) {
    throw new Error("Quality services ownedServices must be an array.");
  }
  const ownedServices = new Set();
  for (const service of state.ownedServices) {
    validateServiceName(service);
    if (ownedServices.has(service)) {
      throw new Error(`Quality services state repeats owned service ${service}.`);
    }
    ownedServices.add(service);
  }

  assertPlainObject(state.containers, "Quality services containers");
  for (const service of Object.keys(state.containers)) {
    validateServiceName(service);
    const ownership = state.containers[service];
    assertPlainObject(ownership, `Quality services container ${service}`);
    assertExactKeys(
      ownership,
      ["id", "owned", "existedBefore"],
      `Quality services container ${service}`,
    );
    normalizeContainerId(ownership.id, { required: true });
    if (typeof ownership.owned !== "boolean" || typeof ownership.existedBefore !== "boolean") {
      throw new Error(`Quality services ownership flags are invalid for ${service}.`);
    }
    if (ownership.owned && ownership.existedBefore) {
      throw new Error(`Preexisting container ${service} cannot be owned by this run.`);
    }
    if (ownership.owned !== ownedServices.has(service)) {
      throw new Error(`Quality services ownedServices is inconsistent for ${service}.`);
    }
  }
  for (const service of ownedServices) {
    if (!Object.hasOwn(state.containers, service)) {
      throw new Error(`Owned service ${service} has no container record.`);
    }
  }
  return state;
}

function validateQualityGateLock(lock) {
  assertPlainObject(lock, "Quality Gate lock");
  assertExactKeys(
    lock,
    ["runId", "pid", "startedAt", "hostname"],
    "Quality Gate lock",
  );
  validateQualityRunId(lock.runId);
  validatePid(lock.pid, "Quality Gate lock pid");
  validateTimestamp(lock.startedAt, "Quality Gate lock startedAt");
  validateHostname(lock.hostname);
  return lock;
}

function assertQualityGateLease(lease) {
  validateQualityGateLock({
    runId: lease.runId,
    pid: lease.pid,
    startedAt: lease.startedAt,
    hostname: lease.hostname,
  });
  const lock = readQualityGateLock({
    expectedRunId: lease.runId,
    lockPath: lease.lockPath,
  });
  if (
    lock.pid !== lease.pid
    || lock.hostname !== lease.hostname
    || lock.startedAt !== lease.startedAt
  ) {
    throw new Error(`Quality Gate lease ${lease.runId} no longer owns its lock.`);
  }
}

function createQualityGateLease({ lockPath, record, staleLocks }) {
  let released = false;
  return {
    ...record,
    lockPath,
    staleLocks,
    release() {
      if (released) return { status: "already-released" };
      const result = releaseQualityGateLock({
        expectedHostname: record.hostname,
        expectedPid: record.pid,
        expectedRunId: record.runId,
        lockPath,
      });
      released = true;
      return result;
    },
  };
}

function recoverAbandonedLockCoordinator({
  isPidAlive,
  onDiagnostic,
  ownerHostname,
  recoveryLockPath,
}) {
  if (!existsSync(recoveryLockPath)) return;
  const coordinator = readQualityGateLock({ lockPath: recoveryLockPath });
  if (coordinator.hostname !== ownerHostname) {
    throw new Error(
      `Quality Gate lock recovery belongs to host ${coordinator.hostname}; ownership cannot be verified locally.`,
    );
  }
  if (isPidAlive(coordinator.pid)) {
    throw new Error(
      `Quality Gate lock recovery for run ${coordinator.runId} is active with pid ${coordinator.pid}.`,
    );
  }
  try {
    rmSync(recoveryLockPath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  onDiagnostic({
    phase: "quality:stale-lock-recovery",
    runId: coordinator.runId,
    pid: coordinator.pid,
    stalePath: recoveryLockPath,
  });
}

function assertRecoverableLock(lock, { isPidAlive, ownerHostname }) {
  if (lock.hostname !== ownerHostname) {
    throw new Error(
      `Quality Gate lock belongs to host ${lock.hostname}; ownership cannot be verified locally.`,
    );
  }
  if (isPidAlive(lock.pid)) {
    throw new Error(
      `Quality Gate run ${lock.runId} is active with pid ${lock.pid}.`,
    );
  }
}

function releaseLockFile({
  expectedHostname,
  expectedPid,
  expectedRunId,
  lockPath,
  label,
}) {
  if (!existsSync(lockPath)) {
    throw new Error(`${label} is missing during release.`);
  }
  const lock = readQualityGateLock({ lockPath });
  const safeRunId = validateQualityRunId(expectedRunId);
  const ownerPid = validatePid(expectedPid, `Expected ${label} pid`);
  const ownerHostname = validateHostname(expectedHostname);
  if (
    lock.runId !== safeRunId
    || lock.pid !== ownerPid
    || lock.hostname !== ownerHostname
  ) {
    throw new Error(
      `Refusing to release ${label} owned by run ${lock.runId} pid ${lock.pid}.`,
    );
  }
  rmSync(lockPath);
  return { status: "released" };
}

function validateQualityRunId(runId) {
  if (typeof runId !== "string" || !RUN_ID_PATTERN.test(runId)) {
    throw new Error(
      "Quality runId must contain 1-80 lowercase alphanumeric or hyphen characters.",
    );
  }
  return runId;
}

function validateServiceName(service) {
  if (typeof service !== "string" || !QUALITY_SERVICE_SET.has(service)) {
    throw new Error(`Unsupported quality service ${String(service)}.`);
  }
  return service;
}

function validatePid(pid, label) {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return pid;
}

function validateTimestamp(value, label) {
  if (
    typeof value !== "string"
    || !Number.isFinite(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) {
    throw new Error(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  return value;
}

function validateHostname(value) {
  if (
    typeof value !== "string"
    || value.length < 1
    || value.length > 255
    || /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    throw new Error("Quality Gate hostname is invalid.");
  }
  return value;
}

function normalizeContainerId(value, options = {}) {
  const id = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (!id && !options.required) return "";
  if (!CONTAINER_ID_PATTERN.test(id)) {
    throw new Error("Docker container ID has an invalid format.");
  }
  return id;
}

function resolveRunStatePath(runId, statePath) {
  const safeRunId = validateQualityRunId(runId);
  const resolvedPath = resolve(statePath ?? resolveQualityServicesStatePath(safeRunId));
  if (basename(resolvedPath) !== `${safeRunId}.json`) {
    throw new Error("Quality services state filename does not match its runId.");
  }
  return resolvedPath;
}

function persistState(statePath, state, options = {}) {
  validateQualityServicesState(state);
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(
    statePath,
    `${JSON.stringify(state, null, 2)}\n`,
    options.exclusive ? { flag: "wx", mode: 0o600 } : { mode: 0o600 },
  );
}

function createExclusiveJson(path, value) {
  let descriptor;
  let failure = null;
  try {
    descriptor = openSync(path, "wx", 0o600);
    writeFileSync(descriptor, `${JSON.stringify(value, null, 2)}\n`);
  } catch (error) {
    failure = error;
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
  if (failure) {
    if (descriptor !== undefined) rmSync(path, { force: true });
    throw failure;
  }
}

function parseJsonFile(path, label) {
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, "utf8"));
  } catch {
    throw new Error(`${label} is not valid JSON; destructive cleanup is blocked.`);
  }
  return parsed;
}

function assertPlainObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
}

function assertExactKeys(value, keys, label) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has missing or unexpected fields.`);
  }
}

function positivePort(value, fallback, label) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`${label} port is invalid.`);
  }
  return port;
}

function tcpAvailable(port) {
  return new Promise((resolveAvailable) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolveAvailable(false);
    }, 500);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolveAvailable(true);
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolveAvailable(false);
    });
  });
}

async function waitFor(check, label, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let interval = 100;
  while (Date.now() < deadline) {
    if (await check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, interval));
    interval = Math.min(Math.round(interval * 1.5), 1_000);
  }
  throw new Error(`${label} no quedó disponible dentro de ${timeoutMs} ms.`);
}

function runForeground(command, args, env) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, {
      env,
      shell: false,
      stdio: "inherit",
    });
    child.once("error", rejectRun);
    child.once("exit", (code, signal) => {
      if (signal) rejectRun(new Error(`${command} terminó por ${signal}.`));
      else if (code === 0) resolveRun();
      else rejectRun(new Error(`${command} terminó con código ${code ?? 1}.`));
    });
  });
}

async function runCleanupCommand(command, args, env) {
  const result = await runSupervisedProcess({
    args,
    command,
    env,
    logPath: resolve(REPO_ROOT, "artifacts/command-diagnostics/quality-services-cleanup.log"),
    phase: "quality:services-cleanup",
    timeoutMs: 60_000,
  });
  if (result.exitCode !== 0 || result.signal) {
    throw new Error(`Docker cleanup failed: ${result.cause}.`);
  }
}

function composeContainerId(service, env) {
  validateServiceName(service);
  const result = spawnSync(
    "docker",
    [
      "compose",
      "--project-name",
      QUALITY_COMPOSE_PROJECT,
      "ps",
      "--all",
      "--quiet",
      service,
    ],
    {
      encoding: "utf8",
      env,
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Unable to inspect Docker service ${service}: ${result.stderr.trim() || `exit ${result.status ?? 1}`}.`,
    );
  }
  const ids = result.stdout.trim().split(/\s+/u).filter(Boolean);
  if (ids.length > 1) {
    throw new Error(`Docker Compose returned multiple containers for ${service}.`);
  }
  return ids[0] ?? "";
}
