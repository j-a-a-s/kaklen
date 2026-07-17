#!/usr/bin/env node
import { readdirSync, readFileSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { auditFormSource } from "./forms-audit-core.mjs";

const root = process.cwd();
const sourceRoot = join(root, "apps/web/src/app");
const files = walk(sourceRoot).filter((file) =>
  [".ts", ".html"].includes(extname(file)) && !file.endsWith(".spec.ts")
);
const findings = [];
let formCount = 0;
let controlCount = 0;

for (const absoluteFile of files) {
  const file = relative(root, absoluteFile);
  const result = auditFormSource(file, readFileSync(absoluteFile, "utf8"));
  findings.push(...result.findings);
  formCount += result.formCount;
  controlCount += result.controlCount;
}

if (findings.length > 0) {
  console.error("FORM STANDARDIZATION FAILED");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

console.log(`✓ ${formCount} forms audited`);
console.log(`✓ ${controlCount} reactive controls checked`);
console.log("FORM STANDARDIZATION PASSED");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}
