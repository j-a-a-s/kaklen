#!/usr/bin/env node
import { verifyGovernanceContract } from "./governance-contract-core.mjs";

const result = verifyGovernanceContract();
if (result.errors.length > 0) {
  console.error("GOVERNANCE CONTRACT FAILED");
  result.errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}

console.log(`✓ Governance files: ${result.fileCount}`);
console.log(`✓ Private workspace packages: ${result.packageCount}`);
console.log("GOVERNANCE CONTRACT PASSED");
