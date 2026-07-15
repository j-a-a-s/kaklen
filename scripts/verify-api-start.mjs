#!/usr/bin/env node
import { spawn } from "node:child_process";

const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3000);
const healthUrl = `http://localhost:${port}/api/health/live`;
const defaultDatabaseUrl = `postgresql://kaklen:kaklen_dev_password@localhost:${process.env.POSTGRES_PORT ?? 5432}/kaklen_dev?schema=public`;
let child = null;

try {
  const verification = await run("node", ["scripts/verify-api-build.mjs", "--files-only"]);
  if (!verification.ok) {
    process.exit(verification.code);
  }

  child = spawn("node", ["apps/api/dist/main.js"], {
    stdio: "inherit",
    shell: false,
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? defaultDatabaseUrl,
      PORT: String(port),
      API_PORT: String(port)
    }
  });

  const response = await waitForHttp(healthUrl, 45_000);
  if (!response.ok) {
    throw new Error(`API start smoke recibio HTTP ${response.status}`);
  }
  console.log(`✓ API productiva responde ${healthUrl}`);
} finally {
  if (child) {
    stopChild(child);
  }
}

async function waitForHttp(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "";
  while (Date.now() < deadline) {
    try {
      return await fetch(url);
    } catch (error) {
      lastError = error instanceof Error ? error.message : "request failed";
      await delay(500);
    }
  }
  throw new Error(`Timeout esperando API productiva ${url}: ${lastError}`);
}

function stopChild(processChild) {
  const pid = processChild.pid;
  if (!pid || processChild.exitCode !== null) {
    return;
  }
  if (process.platform === "win32") {
    processChild.kill("SIGTERM");
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    processChild.kill("SIGTERM");
  }
}

function run(command, args) {
  return new Promise((resolveRun) => {
    const processChild = spawn(command, args, { stdio: "inherit", shell: false, env: process.env });
    processChild.on("exit", (code, signal) => {
      resolveRun({ ok: code === 0 && !signal, code: code ?? 1 });
    });
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
