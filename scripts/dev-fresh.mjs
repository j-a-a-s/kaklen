#!/usr/bin/env node
import { spawn } from "node:child_process";
import { cleanDev } from "./clean-dev.mjs";
import { writeRuntimeConfig } from "./write-runtime-config.mjs";

const steps = [
  { label: "Generando Prisma Client", command: "pnpm", args: ["prisma:generate"] },
  {
    label: "Iniciando desarrollo",
    command: "turbo",
    args: ["run", "build", "--filter=./packages/*"]
  }
];

let currentChild = null;

process.on("SIGINT", () => forwardAndExit("SIGINT"));
process.on("SIGTERM", () => forwardAndExit("SIGTERM"));

console.log("KAKLEN DEV FRESH");
console.log("Limpiando artefactos regenerables...");
cleanDev().forEach((target) => console.log(`✓ ${target}`));
const runtime = writeRuntimeConfig();
console.log(`✓ Runtime config ${runtime.config.version} ${runtime.config.commitSha}`);
const runtimeEnv = createRuntimeEnv(runtime.config);

for (const step of steps) {
  console.log(step.label);
  await run(step.command, step.args, runtimeEnv);
}

console.log("Levantando API y web...");
await run("turbo", ["run", "dev", "--filter=./apps/*", "--parallel"], runtimeEnv);

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    currentChild = spawn(command, args, {
      stdio: "inherit",
      shell: false,
      env
    });
    currentChild.on("exit", (code, signal) => {
      currentChild = null;
      if (signal) {
        reject(new Error(`${command} interrupted by ${signal}`));
        return;
      }
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? 1}`));
    });
  });
}

function forwardAndExit(signal) {
  if (currentChild) {
    currentChild.kill(signal);
  }
  process.exit(signal === "SIGINT" ? 130 : 143);
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
