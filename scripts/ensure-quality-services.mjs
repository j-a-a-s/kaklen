#!/usr/bin/env node
import { ensureQualityServices } from "./quality-services-core.mjs";

try {
  await ensureQualityServices();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
