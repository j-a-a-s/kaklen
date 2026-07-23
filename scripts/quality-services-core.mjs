import { spawn, spawnSync } from "node:child_process";
import { createConnection } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDatabase, loadLocalEnv, readDatabaseUrl } from "./local-db-utils.mjs";
import { runSupervisedProcess } from "./process-supervisor.mjs";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const QUALITY_SERVICES_STATE_PATH = resolve(
  REPO_ROOT,
  "artifacts/quality-services-state.json",
);

export async function ensureQualityServices(options = {}) {
  const env = options.env ?? loadLocalEnv();
  const databaseUrl = readDatabaseUrl(env);
  const redisPort = positivePort(env.REDIS_PORT, 6379, "Redis");
  const smtpPort = positivePort(env.MAILPIT_SMTP_PORT, 1025, "Mailpit SMTP");
  const mailpitPort = positivePort(env.MAILPIT_WEB_PORT, 8025, "Mailpit web");
  const statePath = options.statePath
    ?? env.QUALITY_SERVICES_STATE_PATH
    ?? QUALITY_SERVICES_STATE_PATH;
  const runId = env.QUALITY_RUN_ID ?? `${process.pid}-${Date.now()}`;
  const run = options.run ?? runForeground;
  const readContainerId = options.readContainerId ?? composeContainerId;
  const missing = [];

  const initialDatabase = await checkDatabase(databaseUrl);
  if (!initialDatabase.ok) {
    if (!["unavailable", "timeout"].includes(initialDatabase.type)) {
      throw new Error(initialDatabase.message);
    }
    missing.push("postgres");
  }
  if (!(await tcpAvailable(redisPort))) missing.push("redis");
  if (!(await tcpAvailable(smtpPort)) || !(await tcpAvailable(mailpitPort))) {
    missing.push("mailpit");
  }

  const state = {
    containerIds: {},
    runId,
    startedAt: new Date().toISOString(),
    startedServices: missing,
  };
  persistState(statePath, state);

  if (missing.length > 0) {
    console.log(`Iniciando servicios faltantes: ${missing.join(", ")}`);
    await run("docker", ["compose", "up", "-d", ...missing], env);
    for (const service of missing) {
      state.containerIds[service] = readContainerId(service, env);
    }
    persistState(statePath, state);
  }

  await waitFor(async () => (await checkDatabase(databaseUrl)).ok, "PostgreSQL", 60_000);
  await waitFor(() => tcpAvailable(redisPort), "Redis", 30_000);
  await waitFor(() => tcpAvailable(smtpPort), "Mailpit SMTP", 30_000);
  await waitFor(() => tcpAvailable(mailpitPort), "Mailpit web", 30_000);
  console.log("PostgreSQL, Redis y Mailpit disponibles");

  return state;
}

export async function cleanupQualityServices(options = {}) {
  const statePath = options.statePath ?? QUALITY_SERVICES_STATE_PATH;
  if (!existsSync(statePath)) {
    return { removedServices: [], status: "not-needed" };
  }

  const state = JSON.parse(readFileSync(statePath, "utf8"));
  if (options.expectedRunId && state.runId !== options.expectedRunId) {
    throw new Error(
      `Quality service state belongs to run ${state.runId}, expected ${options.expectedRunId}.`,
    );
  }

  const env = options.env ?? process.env;
  const readContainerId = options.readContainerId ?? composeContainerId;
  const removable = [];
  for (const service of state.startedServices ?? []) {
    const currentId = readContainerId(service, env);
    const expectedId = state.containerIds?.[service] ?? "";
    if (!currentId) continue;
    if (expectedId && currentId !== expectedId) {
      throw new Error(
        `Refusing to remove ${service}: container ownership changed after quality run ${state.runId}.`,
      );
    }
    removable.push(service);
  }

  if (removable.length > 0) {
    const run = options.run ?? runCleanupCommand;
    await run("docker", ["compose", "rm", "--force", "--stop", ...removable], env);
  }
  rmSync(statePath, { force: true });
  return { removedServices: removable, status: "passed" };
}

function persistState(statePath, state) {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
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
  const result = spawnSync("docker", ["compose", "ps", "-q", service], {
    encoding: "utf8",
    env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `Unable to inspect Docker service ${service}: ${result.stderr.trim() || `exit ${result.status ?? 1}`}.`,
    );
  }
  return result.stdout.trim();
}
