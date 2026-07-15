#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { spawn } from "node:child_process";

const summaryPath = "apps/api/coverage/coverage-summary.json";
const thresholds = {
  statements: 90,
  branches: 85,
  functions: 90,
  lines: 90
};

const result = await run("pnpm", [
  "--filter",
  "@kaklen/api",
  "test",
  "--",
  "--coverage",
  "--coverageReporters=json-summary",
  "--coverageReporters=text-summary"
]);

if (!result.ok) {
  process.exit(result.code ?? 1);
}

if (!existsSync(summaryPath)) {
  console.error(`Coverage summary no encontrado: ${summaryPath}`);
  process.exit(1);
}

const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
const total = summary.total;
const failures = [];

for (const [metric, minimum] of Object.entries(thresholds)) {
  const actual = total[metric].pct;
  if (actual < minimum) {
    failures.push(`${metric}: ${actual}% < ${minimum}%`);
  }
}

if (failures.length > 0) {
  console.error("COVERAGE THRESHOLDS FAILED");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("✓ Cobertura cumple umbrales estrictos");

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env: process.env });
    child.on("exit", (code, signal) => {
      resolveRun({ ok: code === 0 && !signal, code: code ?? 1 });
    });
  });
}
