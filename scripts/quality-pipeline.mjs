#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadLocalEnv } from "./local-db-utils.mjs";
import { terminateActiveProcessTrees } from "./process-supervisor.mjs";
import { resolveProfile, runQualityPipeline } from "./quality-pipeline-core.mjs";
import {
  cleanupQualityServices,
  QUALITY_SERVICES_STATE_PATH,
} from "./quality-services-core.mjs";

const profile = process.argv[2] ?? "quality:gate";
const profileDefinition = resolveProfile(profile);
const artifactName = profile === "check" ? "check" : "quality-gate";
const logPath = resolve(`artifacts/${artifactName}.log`);
mkdirSync(dirname(logPath), { recursive: true });
writeFileSync(logPath, `profile=${profile}\n`);
console.log(`KAKLEN QUALITY PIPELINE\nProfile: ${profile}`);
const runId = `${process.pid}-${Date.now()}`;
const abortController = new AbortController();
let receivedSignal = null;
const signalHandlers = new Map();

for (const signal of ["SIGINT", "SIGTERM"]) {
  const handler = () => {
    if (receivedSignal) return;
    receivedSignal = signal;
    appendPhase("CLEANUP", "quality:pipeline", 0, `signal=${signal}`);
    abortController.abort(signal);
    terminateActiveProcessTrees(signal);
  };
  signalHandlers.set(signal, handler);
  process.on(signal, handler);
}

const baseEnv = profileDefinition.environment === "local" ? loadLocalEnv() : process.env;
const executionEnv = {
  ...baseEnv,
  QUALITY_RUN_ID: runId,
  QUALITY_SERVICES_STATE_PATH,
};

if (profileDefinition.environment === "local") {
  const cleanupStarted = Date.now();
  const staleCleanup = await cleanupQualityServices({
    env: executionEnv,
    statePath: QUALITY_SERVICES_STATE_PATH,
  });
  appendPhase(
    "CLEANUP",
    "quality:stale-services",
    Date.now() - cleanupStarted,
    `removedContainers=${staleCleanup.removedServices.length}`,
  );
}

const result = await runQualityPipeline({
  profile,
  abortSignal: abortController.signal,
  env: executionEnv,
  artifactPath: `artifacts/${artifactName}.json`,
  cleanup: profileDefinition.environment === "local"
    ? () => cleanupQualityServices({
      env: executionEnv,
      expectedRunId: runId,
      statePath: QUALITY_SERVICES_STATE_PATH,
    })
    : undefined,
  onTaskStart: (task) => {
    appendPhase("START", `quality:${task.key}`, 0);
    console.log(`\n== ${task.label} [${task.key}] ==`);
  },
  onTaskFinish: (task, record) => {
    appendPhase(
      record.status === "passed" ? "PASS" : "FAIL",
      `quality:${task.key}`,
      record.durationMs,
      `exitCode=${record.exitCode ?? "null"} signal=${record.signal ?? "none"}`,
    );
  },
  onCleanupStart: () => appendPhase("CLEANUP", "quality:services", 0, "status=start"),
  onCleanupFinish: (cleanup) => appendPhase(
    cleanup.status === "passed" ? "CLEANUP" : "FAIL",
    "quality:services",
    cleanup.durationMs,
    `status=${cleanup.status}`,
  ),
});

for (const [signal, handler] of signalHandlers) process.off(signal, handler);

if (result.failure) {
  appendFileSync(logPath, `failure ${result.failure.key} cause=${result.failure.cause}\n`);
  console.error(`\nQUALITY GATE FAILED\nControl: ${result.failure.key}\nCause: ${result.failure.cause}`);
  process.exitCode = result.failure.exitCode ?? 1;
} else {
  appendFileSync(logPath, "status=passed\n");
  if (profile === "check") console.log("\nCHECK PASSED");
  else if (profile.startsWith("release:")) console.log("\nRELEASE READY");
  else console.log("\nQUALITY GATE PASSED");
}

if (receivedSignal && !result.failure) {
  process.exitCode = receivedSignal === "SIGINT" ? 130 : 143;
}

function appendPhase(tag, phase, durationMs, details = "") {
  const suffix = details ? ` ${details}` : "";
  const line = `[${tag}] ${phase} durationMs=${durationMs}${suffix}`;
  appendFileSync(logPath, `${line}\n`);
  console.log(line);
}
