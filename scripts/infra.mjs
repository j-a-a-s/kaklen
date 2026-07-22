#!/usr/bin/env node
import { runInfrastructureCommand } from "./infra-runner-core.mjs";

const action = process.argv[2];

try {
  runInfrastructureCommand(action);
} catch (error) {
  console.error(`Infrastructure validation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
