#!/usr/bin/env node
import {
  cleanupQualityServices,
  readQualityGateLock,
} from "./quality-services-core.mjs";

try {
  const runId = process.env.QUALITY_RUN_ID;
  readQualityGateLock({ expectedRunId: runId });
  const result = await cleanupQualityServices({
    expectedRunId: runId,
  });
  console.log(`Quality services cleanup: ${result.removedServices.length} container(s) removed.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
