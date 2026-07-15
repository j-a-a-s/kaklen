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
const criticalModuleThresholds = {
  statements: 95,
  lines: 95
};
const criticalModules = [
  { name: "Auth", prefix: "apps/api/src/auth/" },
  { name: "Organizations and RBAC", prefix: "apps/api/src/organizations/" },
  { name: "Clients", prefix: "apps/api/src/clients/" },
  { name: "Quotations", prefix: "apps/api/src/quotations/" },
  { name: "Events", prefix: "apps/api/src/events/" }
];

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

for (const moduleInfo of criticalModules) {
  const coverage = aggregateCoverage(summary, moduleInfo.prefix);
  for (const [metric, minimum] of Object.entries(criticalModuleThresholds)) {
    const actual = coverage[metric];
    if (actual < minimum) {
      failures.push(`${moduleInfo.name} ${metric}: ${actual}% < ${minimum}%`);
    }
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

function aggregateCoverage(summary, prefix) {
  const totals = {
    statements: { total: 0, covered: 0 },
    lines: { total: 0, covered: 0 }
  };

  for (const [filePath, fileCoverage] of Object.entries(summary)) {
    if (filePath === "total" || !filePath.includes(prefix)) {
      continue;
    }
    for (const metric of Object.keys(totals)) {
      totals[metric].total += fileCoverage[metric].total;
      totals[metric].covered += fileCoverage[metric].covered;
    }
  }

  return Object.fromEntries(
    Object.entries(totals).map(([metric, value]) => [
      metric,
      value.total === 0 ? 100 : Number(((value.covered / value.total) * 100).toFixed(2))
    ])
  );
}
