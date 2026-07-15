#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const rules = [
  { name: "GitHub token", pattern: /\b(?:github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9]{30,})\b/ },
  { name: "AWS access key", pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: "Private key", pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { name: "Tracked env file", pattern: /(^|\/)\.env$/ },
  { name: "PEM file", pattern: /\.pem$/ }
];

const trackedFiles = execFileSync("git", ["ls-files"], { encoding: "utf8" })
  .split(/\r?\n/)
  .map((file) => file.trim())
  .filter(Boolean);

const findings = [];

for (const file of trackedFiles) {
  for (const rule of rules) {
    if ((rule.name === "Tracked env file" || rule.name === "PEM file") && rule.pattern.test(file)) {
      findings.push({ file, rule: rule.name });
    }
  }

  let content = "";
  try {
    content = readFileSync(file, "utf8");
  } catch {
    continue;
  }

  for (const rule of rules.slice(0, 3)) {
    if (rule.pattern.test(content)) {
      findings.push({ file, rule: rule.name });
    }
  }
}

if (findings.length > 0) {
  console.error("Secret scan encontró hallazgos de alta confianza:");
  for (const finding of findings) {
    console.error(`- ${finding.rule}: ${finding.file}`);
  }
  process.exit(1);
}

console.log("✓ Secret scan sin hallazgos de alta confianza");
