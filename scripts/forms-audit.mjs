#!/usr/bin/env node
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { auditTypeScriptSource } from "./forms-audit-core.mjs";

const root = process.cwd();
const sourceRoot = join(root, "apps/web/src/app");
const artifactPath = join(root, "artifacts/forms-audit.json");
const files = walk(sourceRoot).filter((file) => extname(file) === ".ts" && !file.endsWith(".spec.ts"));
const findings = [];
const controlsByType = {};
let formCount = 0;
let controlCount = 0;

for (const absoluteFile of files) {
  const file = relative(root, absoluteFile);
  const result = auditTypeScriptSource(file, readFileSync(absoluteFile, "utf8"), {
    readExternalTemplate: (_owner, templateUrl) => {
      const externalPath = resolve(dirname(absoluteFile), templateUrl);
      return { file: relative(root, externalPath), content: readFileSync(externalPath, "utf8") };
    }
  });
  findings.push(...result.findings);
  formCount += result.formCount;
  controlCount += result.controlCount;
  for (const [type, count] of Object.entries(result.controlsByType)) {
    controlsByType[type] = (controlsByType[type] ?? 0) + count;
  }
}

if (findings.length > 0) {
  writeArtifact("failed");
  console.error("FORM STANDARDIZATION FAILED");
  [...new Set(findings)].forEach((finding) => console.error(`- ${finding}`));
  process.exit(1);
}

writeArtifact("passed");
console.log(`✓ ${formCount} forms audited`);
console.log(`✓ ${controlCount} controls checked (${Object.entries(controlsByType).map(([type, count]) => `${type}: ${count}`).join(", ")})`);
console.log("FORM STANDARDIZATION PASSED");

function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? walk(path) : [path];
  });
}

function writeArtifact(status) {
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(
    artifactPath,
    `${JSON.stringify({ status, formCount, controlCount, controlsByType, findings: [...new Set(findings)] }, null, 2)}\n`
  );
}
