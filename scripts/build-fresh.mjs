#!/usr/bin/env node
import { spawn } from "node:child_process";
import { cleanDev } from "./clean-dev.mjs";
import { writeRuntimeConfig } from "./write-runtime-config.mjs";

console.log("KAKLEN BUILD FRESH");
cleanDev().forEach((target) => console.log(`✓ ${target}`));
const runtime = writeRuntimeConfig();
console.log(`✓ Runtime config ${runtime.config.version} ${runtime.config.commitSha}`);
await run("pnpm", ["build"], createRuntimeEnv(runtime.config));

function run(command, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code ?? 1}`));
      }
    });
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
