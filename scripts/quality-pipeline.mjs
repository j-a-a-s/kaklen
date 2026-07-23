#!/usr/bin/env node
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadLocalEnv } from "./local-db-utils.mjs";
import { terminateActiveProcessTrees } from "./process-supervisor.mjs";
import { resolveProfile, runQualityPipeline } from "./quality-pipeline-core.mjs";
import {
  cleanupQualityServices,
  createQualityRunId,
  recoverStaleQualityServices,
  resolveQualityServicesStatePath,
  withQualityGateLock,
} from "./quality-services-core.mjs";

const profile = process.argv[2] ?? "quality:gate";
const profileDefinition = resolveProfile(profile);
const artifactName = profile === "check" ? "check" : "quality-gate";
const logPath = resolve(`artifacts/${artifactName}.log`);
const managesQualityServices = profileDefinition.tasks.some(
  (task) => task.key === "local-services",
);
const runId = managesQualityServices ? createQualityRunId() : null;
const abortController = new AbortController();
const signalHandlers = new Map();
let receivedSignal = null;

mkdirSync(dirname(logPath), { recursive: true });
writeFileSync(logPath, `profile=${profile}\n`);
console.log(`KAKLEN QUALITY PIPELINE\nProfile: ${profile}`);

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
  ...(runId ? { QUALITY_RUN_ID: runId } : {}),
};
let result = null;
let orchestrationFailure = null;

try {
  if (runId) {
    const lockStartedAt = Date.now();
    appendPhase("START", "quality:lock", 0, `runId=${runId}`);
    result = await withQualityGateLock(
      {
        runId,
        onDiagnostic: (diagnostic) => appendPhase(
          "CLEANUP",
          diagnostic.phase,
          0,
          `runId=${diagnostic.runId} pid=${diagnostic.pid}`,
        ),
        onRelease: (release) => appendPhase(
          "CLEANUP",
          "quality:lock",
          release.durationMs,
          `runId=${release.runId} status=${release.status}`,
        ),
      },
      async (lease) => {
        appendPhase(
          "PASS",
          "quality:lock",
          Date.now() - lockStartedAt,
          `runId=${runId} pid=${lease.pid}`,
        );
        const staleCleanupStarted = Date.now();
        const staleCleanup = await recoverStaleQualityServices({
          activeLease: lease,
          env: executionEnv,
          onDiagnostic: (diagnostic) => appendPhase(
            "CLEANUP",
            diagnostic.phase,
            0,
            `runId=${diagnostic.runId} removedContainers=${diagnostic.removedServices.length}`,
          ),
        });
        appendPhase(
          "CLEANUP",
          "quality:stale-services",
          Date.now() - staleCleanupStarted,
          `recoveredRuns=${staleCleanup.recoveredRuns.length} removedContainers=${staleCleanup.removedServices.length}`,
        );
        if (abortController.signal.aborted) {
          throw new Error(`Quality Gate cancelled by ${String(abortController.signal.reason)}.`);
        }
        return executePipeline();
      },
    );
  } else {
    result = await executePipeline();
  }
} catch (error) {
  orchestrationFailure = error instanceof Error ? error : new Error(String(error));
  appendPhase(
    "FAIL",
    "quality:services-orchestration",
    0,
    `cause=${formatError(orchestrationFailure)}`,
  );
} finally {
  for (const [signal, handler] of signalHandlers) process.off(signal, handler);
}

if (orchestrationFailure) {
  const cause = formatError(orchestrationFailure);
  appendFileSync(logPath, `failure quality-services-orchestration cause=${cause}\n`);
  console.error(
    `\nQUALITY GATE FAILED\nControl: quality-services-orchestration\nCause: ${cause}`,
  );
  process.exitCode = receivedSignal === "SIGINT"
    ? 130
    : receivedSignal === "SIGTERM"
      ? 143
      : 1;
} else if (result?.failure) {
  appendFileSync(
    logPath,
    `failure ${result.failure.key} cause=${result.failure.cause}\n`,
  );
  console.error(
    `\nQUALITY GATE FAILED\nControl: ${result.failure.key}\nCause: ${result.failure.cause}`,
  );
  process.exitCode = result.failure.exitCode ?? 1;
} else {
  appendFileSync(logPath, "status=passed\n");
  if (profile === "check") console.log("\nCHECK PASSED");
  else if (profile.startsWith("release:")) console.log("\nRELEASE READY");
  else console.log("\nQUALITY GATE PASSED");
}

if (receivedSignal && !orchestrationFailure && !result?.failure) {
  process.exitCode = receivedSignal === "SIGINT" ? 130 : 143;
}

function executePipeline() {
  return runQualityPipeline({
    profile,
    abortSignal: abortController.signal,
    env: executionEnv,
    artifactPath: `artifacts/${artifactName}.json`,
    cleanup: runId
      ? () => cleanupQualityServices({
        env: executionEnv,
        expectedRunId: runId,
        statePath: resolveQualityServicesStatePath(runId),
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
    onCleanupStart: () => appendPhase(
      "CLEANUP",
      "quality:services",
      0,
      "status=start",
    ),
    onCleanupFinish: (cleanup) => appendPhase(
      cleanup.status === "passed" ? "CLEANUP" : "FAIL",
      "quality:services",
      cleanup.durationMs,
      `status=${cleanup.status}`,
    ),
  });
}

function appendPhase(tag, phase, durationMs, details = "") {
  const suffix = details ? ` ${details}` : "";
  const line = `[${tag}] ${phase} durationMs=${durationMs}${suffix}`;
  appendFileSync(logPath, `${line}\n`);
  console.log(line);
}

function formatError(error) {
  if (error instanceof AggregateError) {
    return error.errors
      .map((entry) => entry instanceof Error ? entry.message : String(entry))
      .join("; ");
  }
  return error.message;
}
