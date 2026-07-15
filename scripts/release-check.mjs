#!/usr/bin/env node
import { spawn } from "node:child_process";

const checks = [
  ["Secret scan", "pnpm", ["security:scan"]],
  ["Doctor", "pnpm", ["run", "doctor"]],
  ["Setup", "pnpm", ["run", "setup"]],
  ["DB validate", "pnpm", ["db:validate"]],
  ["Prisma generate", "pnpm", ["prisma:generate"]],
  ["API clean", "pnpm", ["--filter", "@kaklen/api", "clean"]],
  ["API build", "pnpm", ["--filter", "@kaklen/api", "build"]],
  ["API build verification", "pnpm", ["verify:api-build"]],
  ["API start smoke", "pnpm", ["verify:api-start"]],
  ["Lint", "pnpm", ["lint"]],
  ["Tests", "pnpm", ["test"]],
  ["Build", "pnpm", ["build"]],
  ["Web es", "pnpm", ["--filter", "@kaklen/web", "build:es"]],
  ["Web en", "pnpm", ["--filter", "@kaklen/web", "build:en"]],
  ["Web pt-BR", "pnpm", ["--filter", "@kaklen/web", "build:pt-BR"]],
  ["i18n server", "pnpm", ["verify:i18n-server"]],
  ["Full local", "pnpm", ["verify:full-local"]],
  ["E2E", "pnpm", ["e2e"]]
];

const failures = [];

console.log("KAKLEN RELEASE CHECK");

for (const [label, command, args] of checks) {
  console.log("");
  console.log(`== ${label} ==`);
  const result = await run(command, args);
  if (!result.ok) {
    failures.push(`${label}: ${result.detail}`);
  }
}

console.log("");
if (failures.length > 0) {
  console.error("RELEASE BLOCKED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("RELEASE READY");

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env: process.env });
    child.on("exit", (code, signal) => {
      const ok = code === 0 && !signal;
      resolveRun({ ok, detail: signal ? `signal ${signal}` : `exit ${code ?? 1}` });
    });
  });
}
