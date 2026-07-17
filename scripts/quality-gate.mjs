#!/usr/bin/env node
import { spawn } from "node:child_process";

const checks = [
  ["Architecture check", "pnpm", ["architecture:check"]],
  ["Quality scan", "pnpm", ["quality:scan"]],
  ["Forms audit", "pnpm", ["forms:audit"]],
  ["Secret scan", "pnpm", ["security:scan"]],
  ["Mail SMTP verification", "pnpm", ["mail:verify"]],
  ["Product stabilization contracts", "node", ["--test", "scripts/product-stabilization.test.mjs"]],
  ["Database and migrations", "pnpm", ["db:validate"]],
  ["Clean migration verification", "pnpm", ["db:verify:migrations"]],
  ["Password recovery contract", "node", ["--test", "scripts/password-recovery.test.mjs"]],
  ["Email verification contract", "node", ["--test", "scripts/email-verification.test.mjs"]],
  ["Demo clear", "pnpm", ["db:clear:demo"]],
  ["Demo seed", "pnpm", ["db:seed:demo"]],
  ["Demo seed idempotence", "pnpm", ["db:seed:demo"]],
  ["Demo verification", "pnpm", ["db:verify:demo"]],
  ["Lint", "pnpm", ["lint"]],
  ["Tests", "pnpm", ["test"]],
  ["Coverage", "pnpm", ["test:coverage"]],
  ["Workspace build", "pnpm", ["build"]],
  ["API build verification", "pnpm", ["verify:api-build"]],
  ["Localized build es", "pnpm", ["--filter", "@kaklen/web", "build:es"]],
  ["Localized build en", "pnpm", ["--filter", "@kaklen/web", "build:en"]],
  ["Localized build pt-BR", "pnpm", ["--filter", "@kaklen/web", "build:pt-BR"]],
  ["Localized server verification", "pnpm", ["verify:i18n-server"]],
  ["E2E", "pnpm", ["e2e"]],
  ["Accessibility and responsive", "pnpm", ["accessibility:test"]],
  ["Release check", "pnpm", ["release:check"]],
  ["Demo restore after E2E", "pnpm", ["db:seed:demo"]],
  ["Demo final verification", "pnpm", ["db:verify:demo"]]
];

console.log("KAKLEN QUALITY GATE");

for (const [label, command, args] of checks) {
  console.log(`\n== ${label} ==`);
  const result = await run(command, args);
  if (!result.ok) {
    console.error(`\nQUALITY GATE FAILED\nControl: ${label}\nCause: ${result.detail}`);
    process.exit(1);
  }
}

console.log("\nQUALITY GATE PASSED");

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env: process.env });
    child.once("error", (error) => resolveRun({ ok: false, detail: error.message }));
    child.once("exit", (code, signal) => resolveRun({ ok: code === 0 && !signal, detail: signal ? `signal ${signal}` : `exit ${code ?? 1}` }));
  });
}
