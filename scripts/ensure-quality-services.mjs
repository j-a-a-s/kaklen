#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { checkDatabase, loadLocalEnv, readDatabaseUrl } from "./local-db-utils.mjs";

const env = loadLocalEnv();
const databaseUrl = readDatabaseUrl(env);
const redisPort = positivePort(env.REDIS_PORT, 6379, "Redis");
const smtpPort = positivePort(env.MAILPIT_SMTP_PORT, 1025, "Mailpit SMTP");
const mailpitPort = positivePort(env.MAILPIT_WEB_PORT, 8025, "Mailpit web");
const missing = [];

const initialDatabase = await checkDatabase(databaseUrl);
if (!initialDatabase.ok) {
  if (!["unavailable", "timeout"].includes(initialDatabase.type)) {
    throw new Error(initialDatabase.message);
  }
  missing.push("postgres");
}
if (!(await tcpAvailable(redisPort))) missing.push("redis");
if (!(await tcpAvailable(smtpPort)) || !(await tcpAvailable(mailpitPort))) missing.push("mailpit");

if (missing.length > 0) {
  console.log(`Iniciando servicios faltantes: ${missing.join(", ")}`);
  await run("docker", ["compose", "up", "-d", ...missing]);
}

await waitFor(async () => (await checkDatabase(databaseUrl)).ok, "PostgreSQL", 60_000);
await waitFor(() => tcpAvailable(redisPort), "Redis", 30_000);
await waitFor(() => tcpAvailable(smtpPort), "Mailpit SMTP", 30_000);
await waitFor(() => tcpAvailable(mailpitPort), "Mailpit web", 30_000);
console.log("✓ PostgreSQL, Redis y Mailpit disponibles");

function positivePort(value, fallback, label) {
  const port = Number(value ?? fallback);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) throw new Error(`${label} port is invalid.`);
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

function run(command, args) {
  return new Promise((resolveRun, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`${command} terminó por ${signal}.`));
      else if (code === 0) resolveRun();
      else reject(new Error(`${command} terminó con código ${code ?? 1}.`));
    });
  });
}
