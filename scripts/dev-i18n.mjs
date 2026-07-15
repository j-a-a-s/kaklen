#!/usr/bin/env node
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { cleanDev } from "./clean-dev.mjs";
import { createI18nServer, supportedLocales } from "./i18n-server.mjs";
import { writeRuntimeConfig } from "./write-runtime-config.mjs";

const port = Number(process.env.WEB_PORT ?? 4200);
const distRoot = resolve("apps/web/dist/web");
let currentChild = null;
const backgroundChildren = new Set();
let server = null;

process.on("SIGINT", () => forwardAndExit("SIGINT"));
process.on("SIGTERM", () => forwardAndExit("SIGTERM"));

console.log("KAKLEN DEV I18N");
console.log("Limpiando artefactos regenerables...");
cleanDev().forEach((target) => console.log(`✓ ${target}`));
const runtime = writeRuntimeConfig();
console.log(`✓ Runtime config ${runtime.config.version} ${runtime.config.commitSha}`);
const runtimeEnv = createRuntimeEnv(runtime.config);

await run("pnpm", ["prisma:generate"], runtimeEnv);
await run("turbo", ["run", "build", "--filter=./packages/*"], runtimeEnv);
for (const locale of supportedLocales) {
  await run("pnpm", ["--filter", "@kaklen/web", `build:${locale}`], runtimeEnv);
}

startBackground("pnpm", ["--filter", "@kaklen/api", "dev"], runtimeEnv);
server = createI18nServer({ distRoot, port, logRequests: process.env.NODE_ENV !== "production" });
server.listen(port, "0.0.0.0", () => {
  console.log(`✓ Localized web available at http://localhost:${port}/es/login`);
  console.log(`✓ English: http://localhost:${port}/en/login`);
  console.log(`✓ Português: http://localhost:${port}/pt-BR/login`);
  console.log("✓ API available at http://localhost:3000/api/health");
});

function run(command, args, env) {
  return new Promise((resolveRun, reject) => {
    currentChild = spawn(command, args, { stdio: "inherit", shell: false, env });
    currentChild.on("exit", (code, signal) => {
      currentChild = null;
      if (signal) {
        reject(new Error(`${command} interrupted by ${signal}`));
        return;
      }
      if (code === 0) {
        resolveRun();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

function startBackground(command, args, env) {
  const child = spawn(command, args, { stdio: "inherit", shell: false, env });
  backgroundChildren.add(child);
  child.on("exit", (code, signal) => {
    backgroundChildren.delete(child);
    if (server && code !== 0 && signal === null) {
      console.error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`);
      forwardAndExit("SIGTERM");
    }
  });
}

function createRuntimeEnv(config) {
  return {
    ...process.env,
    APP_VERSION: config.version,
    COMMIT_SHA: config.commitSha,
    BUILD_TIME: config.buildTime,
    PUBLIC_APP_ENVIRONMENT: config.environment
  };
}

function forwardAndExit(signal) {
  if (currentChild) {
    currentChild.kill(signal);
  }
  for (const child of backgroundChildren) {
    child.kill(signal);
  }
  if (server) {
    server.close(() => process.exit(signal === "SIGINT" ? 130 : 143));
    return;
  }
  process.exit(signal === "SIGINT" ? 130 : 143);
}
