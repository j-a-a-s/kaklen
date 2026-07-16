#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { cleanDev } from "./clean-dev.mjs";
import { checkDatabase, loadLocalEnv, readDatabaseUrl } from "./local-db-utils.mjs";
import { createI18nServer, supportedLocales } from "./i18n-server.mjs";
import { writeRuntimeConfig } from "./write-runtime-config.mjs";

const apiPort = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
const webPort = Number(process.env.WEB_PORT ?? 4200);
const redisPort = Number(process.env.REDIS_PORT ?? 6379);
const mailpitSmtpPort = Number(process.env.MAILPIT_SMTP_PORT ?? 1025);
const mailpitWebPort = Number(process.env.MAILPIT_WEB_PORT ?? 8025);
const distRoot = resolve("apps/web/dist/web");
const apiBaseUrl = `http://localhost:${apiPort}/api`;
const webOrigin = `http://localhost:${webPort}`;
const managedProcesses = [];
let server = null;
let shuttingDown = false;

process.on("SIGINT", () => {
  void shutdown(130);
});
process.on("SIGTERM", () => {
  void shutdown(143);
});

export function apiHealthLiveUrl(port = apiPort) {
  return `http://localhost:${port}/api/health/live`;
}

export function apiHealthReadyUrl(port = apiPort) {
  return `http://localhost:${port}/api/health/ready`;
}

export function webLoginUrl(locale = "es", port = webPort) {
  return `http://localhost:${port}/${locale}/login`;
}

export function createRuntimeEnv(config, env = loadLocalEnv()) {
  return {
    ...env,
    APP_VERSION: config.version,
    COMMIT_SHA: config.commitSha,
    BUILD_TIME: config.buildTime,
    PUBLIC_APP_ENVIRONMENT: config.environment,
    PUBLIC_API_BASE_URL: apiBaseUrl,
    PORT: String(apiPort),
    API_PORT: String(apiPort),
    WEB_PORT: String(webPort),
    CORS_ALLOWED_ORIGINS: env.CORS_ALLOWED_ORIGINS ?? webOrigin,
    AUTH_ALLOWED_ORIGINS: env.AUTH_ALLOWED_ORIGINS ?? webOrigin,
    MAIL_FROM: env.MAIL_FROM ?? "Kaklen <no-reply@kaklen.local>",
    MAIL_HOST: env.MAIL_HOST ?? "localhost",
    MAIL_PORT: env.MAIL_PORT ?? String(mailpitSmtpPort),
    MAIL_SECURE: env.MAIL_SECURE ?? "false",
    APP_PUBLIC_URL: env.APP_PUBLIC_URL ?? webOrigin,
    PASSWORD_RESET_EXPIRES_MINUTES: env.PASSWORD_RESET_EXPIRES_MINUTES ?? "30"
  };
}

export async function waitForHttp(url, options = {}) {
  const timeoutMs = options.timeoutMs ?? 120000;
  const intervalMs = options.intervalMs ?? 500;
  const deadline = Date.now() + timeoutMs;
  let lastError = "";

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.requestTimeoutMs ?? 2500);
    try {
      const response = await fetch(url, {
        method: options.method ?? "GET",
        signal: controller.signal,
        headers: options.headers
      });
      if (response.ok || (options.acceptStatus?.includes(response.status) ?? false)) {
        return response;
      }
      lastError = `HTTP ${response.status}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
    } finally {
      clearTimeout(timer);
    }
    await delay(intervalMs);
  }

  throw new Error(`Timeout esperando ${url}. Ultimo resultado: ${lastError || "sin respuesta"}`);
}

export function stopManagedProcess(managed, signal = "SIGTERM") {
  managed.stopping = true;
  const pid = managed.child.pid;
  if (!pid || managed.child.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    managed.child.kill(signal);
    return;
  }
  try {
    process.kill(-pid, signal);
  } catch {
    managed.child.kill(signal);
  }
}

export async function stopManagedProcessAndWait(
  managed,
  { gracefulTimeoutMs = 5000, forceTimeoutMs = 2000 } = {}
) {
  if (hasExited(managed.child)) {
    return true;
  }

  const gracefulExit = waitForChildExit(managed.child, gracefulTimeoutMs);
  stopManagedProcess(managed);
  if (await gracefulExit) {
    return true;
  }

  const forcedExit = waitForChildExit(managed.child, forceTimeoutMs);
  stopManagedProcess(managed, "SIGKILL");
  return forcedExit;
}

async function main() {
  console.log("KAKLEN FULL I18N");
  console.log("");

  await runCommand("pnpm", ["run", "doctor"], { allowFailure: true, timeoutMs: 60000 });
  await startLocalServices();
  await ensureDatabase();

  console.log("Limpiando artefactos regenerables...");
  cleanDev().forEach((target) => console.log(`✓ ${target}`));
  const runtime = writeRuntimeConfig();
  const runtimeEnv = createRuntimeEnv(runtime.config);
  console.log(`✓ Runtime config ${runtime.config.version} ${runtime.config.commitSha}`);

  await runCommand("pnpm", ["mail:verify"], { env: runtimeEnv, timeoutMs: 30000 });
  await runCommand("pnpm", ["prisma:generate"], { env: runtimeEnv, timeoutMs: 60000 });
  await runCommand("pnpm", ["prisma:migrate"], { env: runtimeEnv, timeoutMs: 120000 });
  await runCommand("turbo", ["run", "build", "--filter=./packages/*"], { env: runtimeEnv, timeoutMs: 120000 });
  for (const locale of supportedLocales) {
    await runCommand("pnpm", ["--filter", "@kaklen/web", `build:${locale}`], { env: runtimeEnv, timeoutMs: 180000 });
  }

  await runCommand("pnpm", ["--filter", "@kaklen/api", "clean"], { env: runtimeEnv, timeoutMs: 30000 });
  const apiPortAvailable = await waitForTcpUnavailable(apiPort, 10000);
  if (!apiPortAvailable) {
    throw new Error(`El puerto ${apiPort} sigue ocupado. Detenga la API anterior antes de continuar.`);
  }
  const apiProcess = startManagedProcess(
    "api",
    process.execPath,
    [resolve("apps/api/node_modules/@nestjs/cli/bin/nest.js"), "start", "--watch"],
    runtimeEnv,
    { cwd: resolve("apps/api") }
  );
  await waitForHttp(apiHealthLiveUrl(), { timeoutMs: 120000 });
  await delay(500);
  if (hasExited(apiProcess.child)) {
    throw new Error("La API termino durante su inicio. Revise el log anterior.");
  }
  console.log(`✓ API disponible: ${apiBaseUrl}`);
  console.log(`✓ Swagger: http://localhost:${apiPort}/docs`);

  server = createI18nServer({ distRoot, port: webPort, logRequests: process.env.NODE_ENV !== "production" });
  await listen(server, webPort);
  await waitForHttp(webLoginUrl("es"), { timeoutMs: 30000 });

  console.log(`✓ Español: ${webLoginUrl("es")}`);
  console.log(`✓ English: ${webLoginUrl("en")}`);
  console.log(`✓ Português: ${webLoginUrl("pt-BR")}`);
  console.log("");
  console.log("Entorno completo listo. Presione Ctrl+C para detener API y frontend.");

  await new Promise(() => undefined);
}

async function startLocalServices() {
  console.log("Preparando servicios Docker locales...");
  const services = [];
  const databaseUrl = readDatabaseUrl(loadLocalEnv());
  const database = await checkDatabase(databaseUrl);
  if (!database.ok) {
    services.push("postgres");
  }
  if (!(await isTcpAvailable(redisPort))) {
    services.push("redis");
  }
  if (
    !(await isTcpAvailable(mailpitSmtpPort)) ||
    !(await isTcpAvailable(mailpitWebPort))
  ) {
    services.push("mailpit");
  }

  if (services.length > 0) {
    const result = await runCommand("docker", ["compose", "up", "-d", ...services], {
      allowFailure: true,
      timeoutMs: 90000
    });
    if (result.ok) {
      console.log(`✓ Docker Compose ${services.join(" ")}`);
    } else {
      console.log("! Docker Compose no pudo iniciar todos los servicios; se validara lo disponible.");
    }
  } else {
    console.log("✓ Servicios locales ya disponibles");
  }
  await checkOptionalTcp("Redis", redisPort);
  await checkOptionalTcp("Mailpit SMTP", mailpitSmtpPort);
  await checkOptionalTcp("Mailpit web", mailpitWebPort);
}

async function ensureDatabase() {
  const databaseUrl = readDatabaseUrl(loadLocalEnv());
  const check = await waitForDatabase(databaseUrl);
  if (!check.ok) {
    throw new Error(check.message);
  }
  console.log("✓ PostgreSQL disponible");
}

async function waitForDatabase(databaseUrl) {
  let last = await checkDatabase(databaseUrl);
  for (let attempt = 0; attempt < 20 && !last.ok; attempt += 1) {
    await delay(1000);
    last = await checkDatabase(databaseUrl);
  }
  return last;
}

function startManagedProcess(label, command, args, env, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: false,
    env,
    cwd: options.cwd,
    detached: process.platform !== "win32"
  });
  const managed = { label, child, stopping: false };
  managedProcesses.push(managed);
  child.on("exit", (code, signal) => {
    if (shuttingDown || managed.stopping) {
      return;
    }
    const detail = signal ? `signal ${signal}` : `code ${code ?? 1}`;
    console.error(`✗ Proceso ${label} termino inesperadamente con ${detail}`);
    void shutdown(1);
  });
  return managed;
}

async function runCommand(command, args, options = {}) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      env: { ...process.env, ...(options.env ?? {}) }
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
    }, options.timeoutMs ?? 30000);
    child.on("exit", (code, signal) => {
      clearTimeout(timer);
      const ok = code === 0 && !signal;
      if (ok || options.allowFailure) {
        resolveRun({ ok, code, signal });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} failed with ${signal ?? code ?? 1}`));
    });
  });
}

async function checkOptionalTcp(label, port) {
  try {
    await waitForTcpPort("127.0.0.1", port, 5000);
    console.log(`✓ ${label} disponible`);
  } catch {
    console.log(`! ${label} no disponible en localhost:${port}`);
  }
}

function waitForTcpPort(host, port, timeoutMs) {
  return new Promise((resolvePort, reject) => {
    const socket = createConnection({ host, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("timeout"));
    }, timeoutMs);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.end();
      resolvePort();
    });
    socket.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function isTcpAvailable(port) {
  try {
    await waitForTcpPort("127.0.0.1", port, 500);
    return true;
  } catch {
    return false;
  }
}

function listen(httpServer, port) {
  return new Promise((resolveListen, reject) => {
    httpServer.once("error", reject);
    httpServer.listen(port, "0.0.0.0", () => resolveListen());
  });
}

async function shutdown(exitCode) {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  const processShutdowns = managedProcesses.map(async (managed) => {
    const stopped = await stopManagedProcessAndWait(managed);
    if (!stopped) {
      console.error(`! No fue posible confirmar el cierre del proceso ${managed.label}`);
    }
  });
  if (server) {
    await closeServer(server);
    server = null;
  }
  await Promise.all(processShutdowns);
  if (managedProcesses.some((managed) => managed.label === "api")) {
    const apiStopped = await waitForTcpUnavailable(apiPort, 5000);
    if (!apiStopped) {
      console.error(`! El puerto ${apiPort} continua ocupado despues de detener la API`);
    }
  }
  process.exit(exitCode);
}

function hasExited(child) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForChildExit(child, timeoutMs) {
  if (hasExited(child)) {
    return Promise.resolve(true);
  }
  return new Promise((resolveExit) => {
    const onExit = () => {
      clearTimeout(timer);
      resolveExit(true);
    };
    const timer = setTimeout(() => {
      child.off("exit", onExit);
      resolveExit(false);
    }, timeoutMs);
    child.once("exit", onExit);
  });
}

async function waitForTcpUnavailable(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (!(await isTcpAvailable(port))) {
      return true;
    }
    await delay(100);
  }
  return !(await isTcpAvailable(port));
}

function closeServer(httpServer) {
  return new Promise((resolveClose) => {
    let settled = false;
    const finish = () => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timer);
      resolveClose();
    };
    const timer = setTimeout(() => {
      httpServer.closeAllConnections?.();
      finish();
    }, 3000);

    httpServer.close(() => finish());
    httpServer.closeIdleConnections?.();
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

const isEntrypoint = process.argv[1] ? import.meta.url === pathToFileURL(process.argv[1]).href : false;
if (isEntrypoint) {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : "No fue posible iniciar el entorno completo.");
    void shutdown(1);
  });
}
