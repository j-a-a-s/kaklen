import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  activeProcessCount,
  isProcessAlive,
  runSupervisedProcess,
} from "./process-supervisor.mjs";

test("supervised process returns the child exit code", async () => {
  const result = await runSupervisedProcess({
    args: ["-e", "process.exit(7)"],
    command: process.execPath,
    phase: "test:exit-code",
    timeoutMs: 2_000,
  });

  assert.equal(result.exitCode, 7);
  assert.equal(result.timedOut, false);
  assert.equal(result.cleanupExecuted, true);
  assert.equal(activeProcessCount(), 0);
});

test("timeout kills a child process tree that ignores SIGTERM", async () => {
  const result = await runHungTreeFixture({ detachedGrandchild: false });

  assert.equal(result.exitCode, 124);
  assert.equal(result.timedOut, true);
  assert.equal(result.cleanupExecuted, true);
  assert.equal(activeProcessCount(), 0);
  assert.match(result.log, /\[START\].*durationMs=/);
  assert.match(result.log, /\[TIMEOUT\].*durationMs=/);
  assert.match(result.log, /\[CLEANUP\].*durationMs=/);
  assert.match(result.log, /\[FAIL\].*durationMs=/);
});

test(
  "timeout discovers and kills a detached grandchild",
  { skip: !processTreeInspectionAvailable() },
  async () => {
    const result = await runHungTreeFixture({ detachedGrandchild: true });

    assert.equal(result.exitCode, 124);
    assert.equal(result.timedOut, true);
    assert.equal(result.cleanupExecuted, true);
    assert.equal(activeProcessCount(), 0);
  },
);

async function runHungTreeFixture({ detachedGrandchild }) {
  const directory = mkdtempSync(join(tmpdir(), "kaklen-supervisor-"));
  const logPath = join(directory, "timeout.log");
  const childSource = [
    'const { spawn } = require("node:child_process");',
    `const child = spawn(process.execPath, ["-e", ${JSON.stringify('process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)')}], { detached: ${detachedGrandchild}, stdio: "ignore" });`,
    "console.log(child.pid);",
    'process.on("SIGTERM", () => {});',
    "setInterval(() => {}, 1000);",
  ].join(" ");
  const result = await runSupervisedProcess({
    args: ["-e", childSource],
    captureStdout: true,
    command: process.execPath,
    forceSettleMs: 500,
    gracePeriodMs: 150,
    logPath,
    phase: "test:hung-tree",
    teeStdout: false,
    timeoutMs: 150,
  });
  const descendantPid = Number(result.stdout.trim());

  assert.ok(Number.isInteger(descendantPid) && descendantPid > 0);
  await waitFor(() => !isProcessAlive(descendantPid), 5_000);
  assert.equal(isProcessAlive(descendantPid), false);
  return { ...result, log: readFileSync(logPath, "utf8") };
}

test("cleanup callback runs when the child fails", async () => {
  let cleanupCalls = 0;
  const result = await runSupervisedProcess({
    args: ["-e", "process.exit(3)"],
    command: process.execPath,
    onCleanup: async () => {
      cleanupCalls += 1;
    },
    phase: "test:cleanup",
    timeoutMs: 2_000,
  });

  assert.equal(result.exitCode, 3);
  assert.equal(cleanupCalls, 1);
  assert.equal(result.cleanupExecuted, true);
  assert.equal(activeProcessCount(), 0);
});

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return;
    await new Promise((resolveWait) => setTimeout(resolveWait, 25));
  }
}

function processTreeInspectionAvailable() {
  const result = spawnSync("ps", ["-axo", "pid=,ppid=,pgid="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return result.status === 0 && result.stdout.trim().length > 0;
}
