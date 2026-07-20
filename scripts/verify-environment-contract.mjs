#!/usr/bin/env node
import { auditEnvironmentContract } from "./environment-contract-core.mjs";

try {
  const result = auditEnvironmentContract();
  if (result.errors.length > 0) throw new Error(result.errors.join("\n"));
  const localCount = result.manifest.variables.filter((item) => item.localExample).length;
  const productionCount = result.manifest.variables.filter((item) => item.productionExample).length;
  console.log(`✓ Variables documentadas: ${result.manifest.variables.length}`);
  console.log(`✓ .env.example: ${localCount}`);
  console.log(`✓ .env.production.example: ${productionCount}`);
  console.log("ENVIRONMENT CONTRACT PASSED");
} catch (error) {
  console.error(error instanceof Error ? error.message : "Environment contract verification failed.");
  process.exitCode = 1;
}
