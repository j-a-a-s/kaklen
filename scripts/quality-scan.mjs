#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { extname } from "node:path";
import { execFileSync } from "node:child_process";

const textExtensions = new Set([".ts", ".mjs", ".js", ".json", ".md", ".yml", ".yaml", ".html", ".css", ".scss", ".xlf", ".prisma"]);
const ignoredFiles = new Set(["docs/release/TECHNICAL_SCORECARD.md"]);
const debtMarkers = ["TO" + "DO", "FIX" + "ME", "HA" + "CK"];
const findings = [];

for (const file of gitFiles()) {
  if (ignoredFiles.has(file) || !textExtensions.has(extname(file))) {
    continue;
  }
  const source = readFileSync(file, "utf8");
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    if (debtMarkers.some((marker) => new RegExp(`\\b${marker}\\b`).test(line))) {
      findings.push(`${file}:${lineNumber} comentario tecnico pendiente`);
    }
    if (hasExplicitAny(line)) {
      findings.push(`${file}:${lineNumber} uso explicito de any`);
    }
  });
}

if (findings.length > 0) {
  console.error("QUALITY SCAN FAILED");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log("✓ Quality scan sin marcadores de deuda tecnica ni tipos amplios explicitos");

function gitFiles() {
  return execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { encoding: "utf8" }).trim().split("\n").filter(Boolean);
}

function hasExplicitAny(line) {
  if (line.includes("expect.any(")) {
    return false;
  }
  return /(?:^|[({,;=:\s])(?:as\s+any|:\s*any\b|<\s*any\s*>|Array<\s*any\s*>|Record<[^>]+,\s*any\s*>)/.test(line);
}
