#!/usr/bin/env node
import { cleanupQualityServices } from "./quality-services-core.mjs";

try {
  const result = await cleanupQualityServices({
    expectedRunId: process.env.QUALITY_RUN_ID,
  });
  console.log(`Quality services cleanup: ${result.removedServices.length} container(s) removed.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
