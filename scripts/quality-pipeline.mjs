#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { runQualityPipeline } from "./quality-pipeline-core.mjs";

const profile = process.argv[2] ?? "quality:gate";
const logPath = resolve("artifacts/quality-gate.log");
mkdirSync(dirname(logPath), { recursive: true });
writeFileSync(logPath, `profile=${profile}\n`);
console.log(`KAKLEN QUALITY PIPELINE\nProfile: ${profile}`);

const result = await runQualityPipeline({
  profile,
  onTaskStart: (task) => {
    appendFileSync(logPath, `start ${task.key}\n`);
    console.log(`\n== ${task.label} [${task.key}] ==`);
  },
  onTaskFinish: (task, record) => {
    appendFileSync(logPath, `finish ${task.key} status=${record.status} durationMs=${record.durationMs}\n`);
    console.log(`\n${record.status === "passed" ? "✓" : "✗"} ${record.durationMs} ms`);
  }
});

if (result.failure) {
  appendFileSync(logPath, `failure ${result.failure.key} cause=${result.failure.cause}\n`);
  console.error(`\nQUALITY GATE FAILED\nControl: ${result.failure.key}\nCause: ${result.failure.cause}`);
  const failedTask = result.artifact.tasks.find((task) => task.key === result.failure?.key);
  if (failedTask?.signal) {
    process.kill(process.pid, failedTask.signal);
  } else {
    process.exit(failedTask?.exitCode ?? 1);
  }
}

appendFileSync(logPath, "status=passed\n");
if (profile.startsWith("release:")) console.log("\nRELEASE READY");
else console.log("\nQUALITY GATE PASSED");
