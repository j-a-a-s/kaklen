import { spawn, spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const DEFAULT_GRACE_PERIOD_MS = 2_000;
const DEFAULT_FORCE_SETTLE_MS = 2_000;
const MAX_CAPTURE_BYTES = 64 * 1024 * 1024;
const activeProcesses = new Map();

export function runSupervisedProcess(options) {
  const timeoutMs = positiveInteger(options.timeoutMs, "timeoutMs");
  const gracePeriodMs = positiveInteger(
    options.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS,
    "gracePeriodMs",
  );
  const forceSettleMs = positiveInteger(
    options.forceSettleMs ?? DEFAULT_FORCE_SETTLE_MS,
    "forceSettleMs",
  );
  const phase = options.phase ?? options.command;
  const startedAt = Date.now();
  const env = options.env ?? process.env;
  const logPath = options.logPath;

  if (!options.command) {
    throw new Error("A supervised command is required.");
  }

  if (logPath) {
    mkdirSync(dirname(logPath), { recursive: true });
    writeFileSync(logPath, "");
  }

  return new Promise((resolveProcess) => {
    let child;
    let completed = false;
    let finalizing = false;
    let timedOut = false;
    let cancelled = false;
    let terminationReason = null;
    let requestedSignal = null;
    let timeoutTimer;
    let forceTimer;
    let forceSettleTimer;
    let capturedStdout = "";
    let capturedStderr = "";
    let trackedProcessGroups = new Set();

    const durationMs = () => Math.max(0, Date.now() - startedAt);
    const emit = (tag, detail = "") => {
      const suffix = detail ? ` ${detail}` : "";
      const line = `[${tag}] ${phase} durationMs=${durationMs()}${suffix}`;
      const stream = tag === "FAIL" || tag === "TIMEOUT" ? process.stderr : process.stdout;
      stream.write(`${line}\n`);
      if (logPath) appendFileSync(logPath, `${line}\n`);
    };
    const appendOutput = (streamName, chunk) => {
      const text = chunk.toString();
      if (logPath) appendFileSync(logPath, text);
      if (streamName === "stdout") {
        if (options.captureStdout) capturedStdout = boundedAppend(capturedStdout, text);
        if (options.teeStdout !== false) process.stdout.write(text);
      } else {
        if (options.captureStderr) capturedStderr = boundedAppend(capturedStderr, text);
        if (options.teeStderr !== false) process.stderr.write(text);
      }
    };

    const requestTermination = (reason, signal = "SIGTERM") => {
      if (completed || terminationReason) return;
      terminationReason = reason;
      requestedSignal = signal;
      timedOut = reason === "timeout";
      cancelled = reason === "cancelled";

      if (timedOut) {
        emit("TIMEOUT", `timeoutMs=${timeoutMs} pid=${child?.pid ?? "unknown"}`);
      }

      if (child?.pid) {
        trackedProcessGroups = mergeProcessGroups(
          trackedProcessGroups,
          collectProcessGroups(child.pid),
        );
        signalProcessTree(child.pid, signal, trackedProcessGroups);
      }
      forceTimer = setTimeout(() => {
        if (completed || !child?.pid) return;
        emit("CLEANUP", `action=escalate signal=SIGKILL pid=${child.pid}`);
        trackedProcessGroups = mergeProcessGroups(
          trackedProcessGroups,
          collectProcessGroups(child.pid),
        );
        signalProcessTree(child.pid, "SIGKILL", trackedProcessGroups);
      }, gracePeriodMs);
      forceTimer.unref();

      forceSettleTimer = setTimeout(() => {
        if (!completed) void finalize(null, "SIGKILL", null);
      }, gracePeriodMs + forceSettleMs);
      forceSettleTimer.unref();
    };

    const abortHandler = () => {
      const signal = signalFromAbortReason(options.abortSignal?.reason);
      requestTermination("cancelled", signal);
    };

    const finalize = async (exitCode, signal, spawnError) => {
      if (completed || finalizing) return;
      finalizing = true;
      clearTimeout(timeoutTimer);
      clearTimeout(forceTimer);
      clearTimeout(forceSettleTimer);
      options.abortSignal?.removeEventListener("abort", abortHandler);

      let orphanProcessesTerminated = 0;
      if (child?.pid) {
        orphanProcessesTerminated = await cleanupProcessGroups(
          child.pid,
          trackedProcessGroups,
          gracePeriodMs,
          emit,
          terminationReason === null,
        );
      }

      let cleanupError = null;
      try {
        await options.onCleanup?.({
          cancelled,
          exitCode,
          phase,
          signal,
          timedOut,
        });
      } catch (error) {
        cleanupError = error instanceof Error ? error.message : String(error);
      }

      child?.stdout?.destroy();
      child?.stderr?.destroy();
      if (child?.pid) activeProcesses.delete(child.pid);

      let resolvedExitCode = exitCode;
      let resolvedSignal = signal;
      let cause;
      if (spawnError) {
        resolvedExitCode = 1;
        resolvedSignal = null;
        cause = spawnError.message;
      } else if (timedOut) {
        resolvedExitCode = 124;
        resolvedSignal = signal ?? requestedSignal ?? "SIGTERM";
        cause = `timeout after ${timeoutMs} ms`;
      } else if (cancelled) {
        resolvedExitCode = signalExitCode(requestedSignal);
        resolvedSignal = signal ?? requestedSignal;
        cause = `cancelled by ${requestedSignal}`;
      } else if (signal) {
        cause = `signal ${signal}`;
      } else {
        cause = `exit ${exitCode ?? 1}`;
      }

      if (cleanupError) {
        resolvedExitCode = resolvedExitCode === 0 ? 1 : (resolvedExitCode ?? 1);
        cause = `${cause}; cleanup failed: ${cleanupError}`;
      }

      emit(
        "CLEANUP",
        `orphanProcessesTerminated=${orphanProcessesTerminated} callback=${cleanupError ? "failed" : "passed"}`,
      );
      const passed = resolvedExitCode === 0 && !resolvedSignal && !cleanupError;
      emit(
        passed ? "PASS" : "FAIL",
        `exitCode=${resolvedExitCode ?? "null"} signal=${resolvedSignal ?? "none"}`,
      );

      completed = true;
      finalizing = false;
      resolveProcess({
        cancelled,
        cause,
        cleanupExecuted: true,
        cleanupError,
        durationMs: durationMs(),
        exitCode: resolvedExitCode,
        orphanProcessesTerminated,
        pid: child?.pid ?? null,
        signal: resolvedSignal,
        stderr: capturedStderr,
        stdout: capturedStdout,
        timedOut,
      });
    };

    try {
      child = spawn(options.command, options.args ?? [], {
        cwd: options.cwd,
        detached: process.platform !== "win32",
        env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      void finalize(null, null, error instanceof Error ? error : new Error(String(error)));
      return;
    }

    emit(
      "START",
      `pid=${child.pid ?? "unknown"} timeoutMs=${timeoutMs} command=${formatCommand(options.command, options.args ?? [])}`,
    );
    if (child.pid) {
      activeProcesses.set(child.pid, { requestTermination });
    }
    child.stdout.on("data", (chunk) => appendOutput("stdout", chunk));
    child.stderr.on("data", (chunk) => appendOutput("stderr", chunk));
    child.once("error", (error) => void finalize(null, null, error));
    child.once("exit", (code, signal) => void finalize(code, signal, null));

    timeoutTimer = setTimeout(
      () => requestTermination("timeout", "SIGTERM"),
      timeoutMs,
    );
    timeoutTimer.unref();

    if (options.abortSignal) {
      if (options.abortSignal.aborted) abortHandler();
      else options.abortSignal.addEventListener("abort", abortHandler, { once: true });
    }
  });
}

export function terminateActiveProcessTrees(signal = "SIGTERM") {
  const controllers = [...activeProcesses.values()];
  for (const controller of controllers) {
    controller.requestTermination("cancelled", signal);
  }
  return controllers.length;
}

export function activeProcessCount() {
  return activeProcesses.size;
}

export function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

async function cleanupProcessGroups(
  pid,
  knownGroups,
  gracePeriodMs,
  emit,
  allowNaturalDrain,
) {
  const groups = mergeProcessGroups(knownGroups, collectProcessGroups(pid));
  if (allowNaturalDrain) await delay(100);
  const activeGroups = [...groups].filter(processGroupExists);
  if (activeGroups.length === 0) return 0;
  const count = processGroupMemberCount(activeGroups);
  emit(
    "CLEANUP",
    `action=terminate-process-tree pid=${pid} groups=${activeGroups.length} members=${count}`,
  );
  signalProcessTree(pid, "SIGTERM", activeGroups);
  await delay(Math.min(gracePeriodMs, 250));
  if (activeGroups.some(processGroupExists)) {
    signalProcessTree(pid, "SIGKILL", activeGroups);
    await delay(50);
  }
  return count;
}

function signalProcessTree(pid, signal, knownGroups = new Set()) {
  if (process.platform === "win32") {
    const args = ["/PID", String(pid), "/T"];
    if (signal === "SIGKILL") args.push("/F");
    spawnSync("taskkill", args, { stdio: "ignore", windowsHide: true });
    return;
  }

  const groups = mergeProcessGroups(knownGroups, collectProcessGroups(pid));
  for (const processGroupId of groups) {
    try {
      process.kill(-processGroupId, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

function processGroupExists(pid) {
  if (process.platform === "win32") return isProcessAlive(pid);
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    return error.code !== "ESRCH";
  }
}

function processGroupMemberCount(processGroupIds) {
  if (process.platform === "win32") {
    return processGroupIds.some(processGroupExists) ? 1 : 0;
  }
  try {
    const result = spawnSync("ps", ["-axo", "pgid="], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status !== 0) {
      return processGroupIds.filter(processGroupExists).length;
    }
    const expected = new Set(processGroupIds);
    return result.stdout
      .split("\n")
      .map((value) => Number(value.trim()))
      .filter((value) => expected.has(value)).length;
  } catch {
    return processGroupIds.filter(processGroupExists).length;
  }
}

function collectProcessGroups(rootPid) {
  if (process.platform === "win32") return new Set([rootPid]);
  const result = spawnSync("ps", ["-axo", "pid=,ppid=,pgid="], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (result.status !== 0) return new Set([rootPid]);

  const entries = result.stdout
    .split("\n")
    .map((line) => line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)$/))
    .filter(Boolean)
    .map((match) => ({
      pid: Number(match[1]),
      ppid: Number(match[2]),
      pgid: Number(match[3]),
    }));
  const descendants = new Set([rootPid]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const entry of entries) {
      if (descendants.has(entry.ppid) && !descendants.has(entry.pid)) {
        descendants.add(entry.pid);
        changed = true;
      }
    }
  }

  const groups = new Set([rootPid]);
  for (const entry of entries) {
    if (descendants.has(entry.pid) && entry.pgid > 1) groups.add(entry.pgid);
  }
  return groups;
}

function mergeProcessGroups(...collections) {
  const merged = new Set();
  for (const collection of collections) {
    for (const processGroupId of collection) merged.add(processGroupId);
  }
  return merged;
}

function boundedAppend(current, addition) {
  const next = current + addition;
  if (Buffer.byteLength(next) <= MAX_CAPTURE_BYTES) return next;
  return next.slice(-MAX_CAPTURE_BYTES);
}

function formatCommand(command, args) {
  return [command, ...args].map((value) => JSON.stringify(value)).join(" ");
}

function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

function signalFromAbortReason(reason) {
  return reason === "SIGINT" || reason === "SIGTERM" ? reason : "SIGTERM";
}

function signalExitCode(signal) {
  if (signal === "SIGINT") return 130;
  if (signal === "SIGTERM") return 143;
  return 1;
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}
