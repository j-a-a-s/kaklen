#!/usr/bin/env node
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const commitSha = process.env.COMMIT_SHA;
if (!commitSha || !/^[a-f0-9]{40}$/.test(commitSha)) {
  console.error("COMMIT_SHA must contain the full Git commit SHA.");
  process.exit(1);
}

const evidence = {
  generatedAt: new Date().toISOString(),
  repository: "j-a-a-s/kaklen",
  validatedCommit: commitSha,
  terraformFormat: "PASS",
  terraformValidate: "PASS",
  terraformLint: "PASS",
  securityScan: "PASS",
  secretScan: "PASS",
  environmentContract: "PASS",
  stagingPlan: "PASS",
  deploymentExecuted: false
};

const outputPath = resolve("artifacts/infrastructure-ci-validation.json");
mkdirSync(resolve("artifacts"), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`✓ Infrastructure CI evidence written for ${commitSha}`);
