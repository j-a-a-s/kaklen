#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compareRemoteGovernance } from "./governance-contract-core.mjs";

const metadataPath = resolve("docs/governance/repository-governance.json");

try {
  const expected = JSON.parse(readFileSync(metadataPath, "utf8"));
  const repository = ghJson(["api", `repos/${expected.repository}`]);
  const topics = ghJson(["api", `repos/${expected.repository}/topics`]);
  const privateReporting = ghJson([
    "api",
    `repos/${expected.repository}/private-vulnerability-reporting`
  ]);
  const actual = {
    repository: repository.full_name,
    visibility: repository.visibility,
    defaultBranch: repository.default_branch,
    description: repository.description ?? "",
    homepage: repository.homepage || null,
    topics: topics.names,
    privateVulnerabilityReporting: privateReporting.enabled
  };
  const errors = compareRemoteGovernance(expected, actual);

  if (errors.length > 0) {
    console.error("GOVERNANCE REMOTE FAILED");
    errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }

  console.log(`✓ Repository: ${expected.repository}`);
  console.log(`✓ Topics: ${expected.topics.length}`);
  console.log("GOVERNANCE REMOTE PASSED");
} catch (error) {
  console.error("GOVERNANCE REMOTE FAILED");
  console.error(error instanceof Error ? error.message : "Remote verification failed.");
  process.exit(1);
}

function ghJson(args) {
  const output = execFileSync("gh", args, {
    encoding: "utf8",
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"]
  });
  return JSON.parse(output);
}
