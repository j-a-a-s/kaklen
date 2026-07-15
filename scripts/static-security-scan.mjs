#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { execFileSync } from "node:child_process";

const scannedExtensions = new Set([".ts", ".mjs", ".js", ".html"]);
const rules = [
  { id: "dangerous-eval", pattern: /\beval\s*\(/, message: "eval no debe usarse" },
  { id: "dynamic-function", pattern: /\bnew\s+Function\s*\(/, message: "Function constructor no debe usarse" },
  { id: "unsafe-html", pattern: /\.innerHTML\s*=/, message: "innerHTML directo requiere sanitizacion explicita" },
  { id: "document-write", pattern: /\bdocument\.write\s*\(/, message: "document.write no debe usarse" },
  {
    id: "raw-query-unsafe",
    pattern: new RegExp("\\$queryRaw" + "Unsafe\\b|\\$executeRaw" + "Unsafe\\b"),
    message: "Prisma raw unsafe no debe usarse"
  },
  {
    id: "secret-log",
    pattern: /console\.(log|error|warn)\([^)]*\$\{[^}]*(password|token|secret|authorization)[^}]*}/i,
    message: "no registrar secretos o tokens"
  }
];
const findings = [];

for (const file of gitFiles()) {
  if (!scannedExtensions.has(extname(file))) {
    continue;
  }
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const rule of rules) {
      if (rule.pattern.test(line)) {
        findings.push(`${file}:${index + 1} ${rule.id}: ${rule.message}`);
      }
    }
  });
}

if (findings.length > 0) {
  console.error("STATIC SECURITY SCAN FAILED");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("✓ Static security scan sin hallazgos criticos conocidos");

function gitFiles() {
  return execFileSync("git", ["ls-files"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
}
