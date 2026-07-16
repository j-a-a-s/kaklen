#!/usr/bin/env node
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cleanDev } from "./clean-dev.mjs";
import {
  E2EInfrastructureError,
  InterruptController,
  ProcessSupervisor,
  executeE2ELifecycle,
  normalizePlaywrightArguments,
  printE2EResult
} from "./e2e-runner-core.mjs";
import { supportedLocales } from "./i18n-server.mjs";
import { checkDatabase, loadLocalEnv, parseDatabaseUrl, readDatabaseUrl } from "./local-db-utils.mjs";
import { writeRuntimeConfig } from "./write-runtime-config.mjs";

const apiPort = positiveInteger(process.env.PORT ?? process.env.API_PORT, 3000, "API");
const webPort = positiveInteger(process.env.WEB_PORT, 4200, "web");
const redisPort = positiveInteger(process.env.REDIS_PORT, 6379, "Redis");
const mailpitSmtpPort = positiveInteger(process.env.MAILPIT_SMTP_PORT, 1025, "Mailpit SMTP");
const mailpitWebPort = positiveInteger(process.env.MAILPIT_WEB_PORT, 8025, "Mailpit web");
const startupTimeoutMs = positiveInteger(process.env.E2E_STARTUP_TIMEOUT_MS, 120_000, "startup timeout");
const commandTimeoutMs = positiveInteger(process.env.E2E_COMMAND_TIMEOUT_MS, 300_000, "command timeout");
const shutdownTimeoutMs = positiveInteger(process.env.E2E_SHUTDOWN_TIMEOUT_MS, 5_000, "shutdown timeout");
const forceTimeoutMs = positiveInteger(process.env.E2E_FORCE_TIMEOUT_MS, 2_000, "force timeout");
const apiBaseUrl = `http://localhost:${apiPort}/api`;
const webBaseUrl = `http://localhost:${webPort}`;
const playwrightArguments = normalizePlaywrightArguments(process.argv.slice(2));
const localEnv = loadLocalEnv();
const startedDockerServices = [];

export async function runE2E() {
  const interruptController = new InterruptController();
  const supervisor = new ProcessSupervisor({
    gracefulTimeoutMs: shutdownTimeoutMs,
    forceTimeoutMs
  });
  const onSigint = () => interruptController.request("SIGINT");
  const onSigterm = () => interruptController.request("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);

  let runtimeEnv = null;
  const result = await executeE2ELifecycle({
    supervisor,
    interruptController,
    prepare: async () => {
      console.log("KAKLEN E2E");
      console.log(`[e2e:health] Verificando puertos ${apiPort} y ${webPort}.`);
      await assertPortFree(apiPort, "api", "API");
      await assertPortFree(webPort, "web", "frontend localizado");
      await ensureLocalServices(supervisor);

      console.log("[e2e:health] Limpiando artefactos regenerables.");
      cleanDev();
      process.env.PUBLIC_API_BASE_URL = apiBaseUrl;
      const runtime = writeRuntimeConfig();
      runtimeEnv = createRuntimeEnv(runtime.config);

      await runFinite(supervisor, "prisma-generate", "pnpm", ["prisma:generate"], runtimeEnv, 60_000);
      await runFinite(supervisor, "prisma-migrate", "pnpm", ["prisma:migrate"], runtimeEnv, 120_000);
      await runFinite(supervisor, "packages-build", "turbo", ["run", "build", "--filter=./packages/*"], runtimeEnv, 120_000);
      for (const locale of supportedLocales) {
        await runFinite(
          supervisor,
          `web-build-${locale}`,
          "pnpm",
          ["--filter", "@kaklen/web", `build:${locale}`],
          runtimeEnv,
          180_000
        );
      }
      await runFinite(supervisor, "api-clean", "pnpm", ["--filter", "@kaklen/api", "clean"], runtimeEnv, 30_000);
    },
    startApi: async () => {
      console.log(`[e2e:api] Iniciando Nest en puerto ${apiPort}.`);
      return supervisor.start({
        label: "api",
        command: process.execPath,
        args: [resolve("apps/api/node_modules/@nestjs/cli/bin/nest.js"), "start", "--watch"],
        cwd: resolve("apps/api"),
        env: runtimeEnv
      });
    },
    waitForApi: async () => {
      await waitForHttp({
        url: `${apiBaseUrl}/health/ready`,
        processName: "api",
        timeoutMs: startupTimeoutMs,
        validate: async (response) => {
          if (!response.ok || !response.headers.get("content-type")?.includes("application/json")) return false;
          const body = await response.json();
          return body?.status === "ok" && body?.checks?.database === "ok";
        }
      });
      console.log(`[e2e:health] API lista: ${apiBaseUrl}/health/ready`);
    },
    startWeb: async () => {
      console.log(`[e2e:web] Iniciando frontend localizado en puerto ${webPort}.`);
      return supervisor.start({
        label: "web",
        command: process.execPath,
        args: [resolve("scripts/serve-i18n.mjs")],
        env: runtimeEnv
      });
    },
    waitForWeb: async () => {
      await waitForHttp({
        url: `${webBaseUrl}/es/login`,
        processName: "web",
        timeoutMs: startupTimeoutMs,
        validate: async (response) => {
          if (!response.ok || !response.headers.get("content-type")?.includes("text/html")) return false;
          return (await response.text()).includes("<kaklen-root");
        }
      });
      console.log(`[e2e:health] Web lista: ${webBaseUrl}/es/login`);
    },
    startPlaywright: async () => {
      console.log(`[e2e:playwright] Ejecutando playwright test ${playwrightArguments.join(" ")}`.trim());
      return supervisor.start({
        label: "playwright",
        role: "test",
        command: "pnpm",
        args: ["exec", "playwright", "test", ...playwrightArguments],
        env: runtimeEnv
      });
    },
    cleanupEnvironment: async () => {
      if (startedDockerServices.length === 0) return;
      console.log(`[e2e:cleanup] Deteniendo servicios Docker iniciados por el runner: ${startedDockerServices.join(", ")}.`);
      await runFinite(
        supervisor,
        "docker-stop",
        "docker",
        ["compose", "stop", ...startedDockerServices],
        runtimeEnv ?? localEnv,
        60_000
      );
    }
  });

  process.removeListener("SIGINT", onSigint);
  process.removeListener("SIGTERM", onSigterm);
  printE2EResult(result);
  return result;
}

async function ensureLocalServices(supervisor) {
  const databaseUrl = readDatabaseUrl(localEnv);
  const database = await checkDatabase(databaseUrl);
  const missing = [];

  if (!database.ok) {
    const parsed = parseDatabaseUrl(databaseUrl);
    if (!parsed || !["localhost", "127.0.0.1", "::1"].includes(parsed.host)) {
      throw new E2EInfrastructureError({
        processName: "postgres",
        phase: "prepare",
        cause: database.message
      });
    }
    if (!["unavailable", "timeout"].includes(database.type)) {
      throw new E2EInfrastructureError({
        processName: "postgres",
        phase: "prepare",
        cause: database.message
      });
    }
    missing.push("postgres");
  }
  if (!(await isTcpAvailable(redisPort))) missing.push("redis");
  if (!(await isTcpAvailable(mailpitSmtpPort)) || !(await isTcpAvailable(mailpitWebPort))) missing.push("mailpit");

  if (missing.length > 0) {
    console.log(`[e2e:health] Iniciando Docker Compose: ${missing.join(", ")}.`);
    await runFinite(supervisor, "docker-up", "docker", ["compose", "up", "-d", ...missing], localEnv, 90_000);
    startedDockerServices.push(...missing);
  }

  await waitForDatabase(databaseUrl, startupTimeoutMs);
  await waitForTcp(redisPort, "redis", startupTimeoutMs);
  await waitForTcp(mailpitSmtpPort, "mailpit", startupTimeoutMs);
  await waitForTcp(mailpitWebPort, "mailpit", startupTimeoutMs);
  console.log("[e2e:health] PostgreSQL, Redis y Mailpit disponibles.");
}

async function runFinite(supervisor, label, command, args, env, timeoutMs = commandTimeoutMs) {
  console.log(`[e2e:health] ${label}: ${command} ${args.join(" ")}`);
  const managed = supervisor.start({ label, role: "task", command, args, env });
  const outcome = await waitForManagedOutcome(managed, timeoutMs);
  if (!outcome) {
    managed.shutdownRequestedByRunner = true;
    await supervisor.stop(managed);
    throw new E2EInfrastructureError({
      processName: label,
      phase: supervisor.phase,
      cause: `Timeout después de ${timeoutMs} ms.`
    });
  }
  if (outcome.error || outcome.code !== 0 || outcome.signal) {
    throw new E2EInfrastructureError({
      processName: label,
      phase: supervisor.phase,
      cause: outcome.error?.message ?? `Comando terminó con ${outcome.signal ? `señal ${outcome.signal}` : `código ${outcome.code ?? 1}`}.`,
      code: outcome.code,
      signal: outcome.signal
    });
  }
}

async function waitForHttp({ url, processName, timeoutMs, validate }) {
  const deadline = Date.now() + timeoutMs;
  let intervalMs = 100;
  let lastCause = "sin respuesta";
  while (Date.now() < deadline) {
    const controller = new AbortController();
    const requestTimer = setTimeout(() => controller.abort(), 2_500);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (await validate(response)) return;
      lastCause = `HTTP ${response.status} con contenido no válido`;
    } catch (error) {
      lastCause = error instanceof Error ? error.message : "request failed";
    } finally {
      clearTimeout(requestTimer);
    }
    await timeout(intervalMs);
    intervalMs = Math.min(Math.round(intervalMs * 1.5), 1_000);
  }
  throw new E2EInfrastructureError({
    processName,
    phase: `${processName}-health`,
    cause: `Health check no respondió dentro de ${timeoutMs} ms: ${lastCause}`
  });
}

async function waitForDatabase(databaseUrl, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let intervalMs = 100;
  let last = await checkDatabase(databaseUrl);
  while (!last.ok && Date.now() < deadline) {
    await timeout(intervalMs);
    intervalMs = Math.min(Math.round(intervalMs * 1.5), 1_000);
    last = await checkDatabase(databaseUrl);
  }
  if (!last.ok) {
    throw new E2EInfrastructureError({
      processName: "postgres",
      phase: "prepare",
      cause: last.message
    });
  }
}

async function waitForTcp(port, processName, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let intervalMs = 100;
  while (Date.now() < deadline) {
    if (await isTcpAvailable(port)) return;
    await timeout(intervalMs);
    intervalMs = Math.min(Math.round(intervalMs * 1.5), 1_000);
  }
  throw new E2EInfrastructureError({
    processName,
    phase: "prepare",
    cause: `Puerto ${port} no quedó disponible dentro de ${timeoutMs} ms.`
  });
}

async function assertPortFree(port, processName, description) {
  if (await isTcpAvailable(port)) {
    throw new E2EInfrastructureError({
      processName,
      phase: "prepare",
      cause: `El puerto ${port} ya está ocupado por un proceso ajeno (${description}). El runner no reutiliza ni termina servidores que no inició.`
    });
  }
}

function isTcpAvailable(port) {
  return new Promise((resolveAvailable) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    const timer = setTimeout(() => {
      socket.destroy();
      resolveAvailable(false);
    }, 400);
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

function createRuntimeEnv(config) {
  return {
    ...localEnv,
    APP_VERSION: config.version,
    COMMIT_SHA: config.commitSha,
    BUILD_TIME: config.buildTime,
    PUBLIC_APP_ENVIRONMENT: config.environment,
    PUBLIC_API_BASE_URL: apiBaseUrl,
    APP_PUBLIC_URL: `${webBaseUrl}/es`,
    PORT: String(apiPort),
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    CORS_ALLOWED_ORIGINS: webBaseUrl,
    AUTH_ALLOWED_ORIGINS: webBaseUrl,
    TRUST_PROXY: "true",
    E2E_API_BASE_URL: `http://localhost:${apiPort}`,
    E2E_WEB_BASE_URL: webBaseUrl,
    E2E_MAILPIT_BASE_URL: `http://localhost:${mailpitWebPort}`
  };
}

function positiveInteger(value, fallback, label) {
  const parsed = Number(value ?? fallback);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${label} debe ser un entero positivo.`);
  }
  return parsed;
}

function timeout(ms) {
  return new Promise((resolveTimeout) => setTimeout(resolveTimeout, ms));
}

function waitForManagedOutcome(managed, timeoutMs) {
  if (managed.outcome) return Promise.resolve(managed.outcome);
  return new Promise((resolveOutcome) => {
    let settled = false;
    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveOutcome(outcome);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    managed.exitPromise.then(finish);
  });
}

const isEntrypoint = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isEntrypoint) {
  const result = await runE2E().catch((error) => ({
    kind: "infrastructure",
    exitCode: 2,
    processName: "runner",
    code: null,
    signal: null,
    phase: "initialization",
    cause: error instanceof Error ? error.message : "No fue posible iniciar el runner E2E.",
    warnings: []
  }));
  if (result.phase === "initialization") {
    printE2EResult(result);
  }
  process.exitCode = result.exitCode;
}
