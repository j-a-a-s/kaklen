#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const apiRoot = resolve(repoRoot, "apps/api");
const distRoot = resolve(apiRoot, "dist");
const filesOnly = process.argv.includes("--files-only");
const requiredFiles = [
  "main.js",
  "prisma/prisma.service.js",
  "health/health.service.js"
];

try {
  verifyRequiredFiles();
  verifyRelativeRequires();
  if (!filesOnly) {
    await verifyDistStarts();
  }
  console.log("✓ API build verificado");
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible verificar el build de API.");
  process.exit(1);
}

function verifyRequiredFiles() {
  const missing = requiredFiles.filter((file) => !existsSync(resolve(distRoot, file)));
  if (missing.length > 0) {
    throw new Error(`Build API incompleto. Faltan archivos en apps/api/dist: ${missing.join(", ")}`);
  }
}

function verifyRelativeRequires() {
  const unresolved = [];
  for (const file of listJavaScriptFiles(distRoot)) {
    const source = readFileSync(file, "utf8");
    const localRequire = createRequire(pathToFileURL(file).href);
    for (const specifier of relativeRequireSpecifiers(source)) {
      try {
        localRequire.resolve(specifier);
      } catch {
        unresolved.push(`${relative(repoRoot, file)} -> ${specifier}`);
      }
    }
  }
  if (unresolved.length > 0) {
    throw new Error(`Build API contiene imports relativos no resueltos:\n${unresolved.join("\n")}`);
  }
}

async function verifyDistStarts() {
  const port = await getFreePort();
  const output = { stdout: "", stderr: "" };
  const child = spawn(process.execPath, ["dist/main.js"], {
    cwd: apiRoot,
    env: {
      ...process.env,
      PORT: String(port),
      API_PORT: String(port),
      LOG_LEVEL: "error"
    },
    stdio: ["ignore", "pipe", "pipe"]
  });
  child.stdout.on("data", (chunk) => {
    output.stdout += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output.stderr += chunk.toString();
  });

  try {
    await waitForHealth(port, child, output);
  } finally {
    await stopProcess(child);
  }
}

function listJavaScriptFiles(root) {
  const entries = readdirSync(root, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = join(root, entry.name);
    if (entry.isDirectory()) {
      return listJavaScriptFiles(fullPath);
    }
    return extname(entry.name) === ".js" ? [fullPath] : [];
  });
}

function relativeRequireSpecifiers(source) {
  const specifiers = [];
  const requirePattern = /require\(["'](\.{1,2}\/[^"']+)["']\)/g;
  for (const match of source.matchAll(requirePattern)) {
    specifiers.push(match[1]);
  }
  return specifiers;
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("No fue posible reservar un puerto local.")));
        return;
      }
      const port = address.port;
      server.close(() => resolvePort(port));
    });
  });
}

async function waitForHealth(port, child, output) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw startError(output, `node apps/api/dist/main.js termino con codigo ${child.exitCode}`);
    }
    if (output.stderr.includes("Cannot find module") || output.stdout.includes("Cannot find module")) {
      throw startError(output, "node apps/api/dist/main.js fallo con MODULE_NOT_FOUND");
    }
    try {
      const response = await fetch(`http://localhost:${port}/api/health/live`);
      if (response.ok) {
        return;
      }
    } catch {
      // The process is still compiling or booting.
    }
    await delay(500);
  }
  throw startError(output, "Timeout esperando que node apps/api/dist/main.js responda health.");
}

function startError(output, message) {
  const details = [output.stdout.trim(), output.stderr.trim()].filter(Boolean).join("\n");
  return new Error(details ? `${message}\n${details}` : message);
}

function stopProcess(child) {
  return new Promise((resolveStop) => {
    if (child.exitCode !== null) {
      resolveStop();
      return;
    }
    child.once("exit", () => resolveStop());
    child.kill("SIGTERM");
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 3000);
  });
}

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}
