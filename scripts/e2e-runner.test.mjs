import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import {
  E2EInfrastructureError,
  InterruptController,
  ProcessSupervisor,
  executeE2ELifecycle,
  normalizePlaywrightArguments,
  printE2EResult
} from "./e2e-runner-core.mjs";

test("normalizes the pnpm argument separator before invoking Playwright", () => {
  assert.deepEqual(normalizePlaywrightArguments(["--", "--grep", "controlled failure"]), [
    "--grep",
    "controlled failure"
  ]);
  assert.deepEqual(normalizePlaywrightArguments(["--ui"]), ["--ui"]);
});

test("Playwright success treats runner SIGTERM cleanup as expected", async () => {
  const harness = createHarness({ playwright: (child) => child.finish(0, null) });
  const result = await harness.run();

  assert.equal(result.kind, "passed");
  assert.equal(result.exitCode, 0);
  assert.deepEqual(harness.signals, [
    ["web", "SIGTERM"],
    ["api", "SIGTERM"]
  ]);
  assert.equal(harness.activeProcesses().length, 0);
});

test("API exit before Playwright is an infrastructure failure", async () => {
  const harness = createHarness({
    api: (child) => child.finish(1, null),
    waitForApi: () => new Promise(() => undefined)
  });
  const result = await harness.run();

  assert.equal(result.kind, "infrastructure");
  assert.equal(result.processName, "api");
  assert.equal(result.code, 1);
  assert.equal(result.phase, "api-start");
  assert.equal(harness.activeProcesses().length, 0);
});

test("web exit code one before readiness is an infrastructure failure", async () => {
  const harness = createHarness({
    web: (child) => child.finish(1, null),
    waitForWeb: () => new Promise(() => undefined)
  });
  const result = await harness.run();

  assert.equal(result.kind, "infrastructure");
  assert.equal(result.processName, "web");
  assert.equal(result.code, 1);
  assert.equal(result.phase, "web-start");
  assert.equal(harness.activeProcesses().length, 0);
});

test("Playwright non-zero exit is an E2E failure with the same code", async () => {
  const harness = createHarness({ playwright: (child) => child.finish(7, null) });
  const result = await harness.run();

  assert.equal(result.kind, "failed");
  assert.equal(result.processName, "playwright");
  assert.equal(result.exitCode, 7);
  assert.equal(result.code, 7);
  assert.equal(harness.activeProcesses().length, 0);
});

test("startup timeout is an infrastructure failure", async () => {
  const harness = createHarness({
    waitForApi: async () => {
      throw new E2EInfrastructureError({
        processName: "api",
        phase: "api-health",
        cause: "Health check no respondió dentro de 120000 ms."
      });
    }
  });
  const result = await harness.run();

  assert.equal(result.kind, "infrastructure");
  assert.equal(result.processName, "api");
  assert.match(result.cause, /120000 ms/);
  assert.equal(harness.activeProcesses().length, 0);
});

test("SIGKILL cleanup warning preserves a successful Playwright result", async () => {
  const harness = createHarness({
    playwright: (child) => child.finish(0, null),
    ignoreSigtermFor: new Set(["api"])
  });
  const result = await harness.run();

  assert.equal(result.kind, "passed");
  assert.equal(result.exitCode, 0);
  assert.ok(result.warnings.includes("api requirió SIGKILL."));
  assert.deepEqual(harness.signals.filter(([label]) => label === "api"), [
    ["api", "SIGTERM"],
    ["api", "SIGKILL"]
  ]);
  assert.equal(harness.activeProcesses().length, 0);
});

test("Ctrl+C triggers controlled cleanup and exit code 130", async () => {
  const harness = createHarness({
    playwright: () => harness.interruptController.request("SIGINT")
  });
  const result = await harness.run();

  assert.equal(result.kind, "infrastructure");
  assert.equal(result.processName, "runner");
  assert.equal(result.signal, "SIGINT");
  assert.equal(result.exitCode, 130);
  assert.equal(harness.activeProcesses().length, 0);
});

test("final output contains exactly one allowed result heading", () => {
  const lines = [];
  const logger = {
    log: (line) => lines.push(line),
    error: (line) => lines.push(line),
    warn: (line) => lines.push(line)
  };
  printE2EResult({
    kind: "failed",
    exitCode: 3,
    processName: "playwright",
    code: 3,
    signal: null,
    phase: "playwright",
    cause: "controlled failure",
    warnings: []
  }, logger);

  const headings = lines.filter((line) => ["E2E PASSED", "E2E FAILED", "E2E INFRASTRUCTURE FAILED"].includes(line));
  assert.deepEqual(headings, ["E2E FAILED"]);
});

test("successful output documents controlled SIGTERM cleanup", () => {
  const lines = [];
  const logger = {
    log: (line) => lines.push(line),
    error: (line) => lines.push(line),
    warn: (line) => lines.push(line)
  };
  printE2EResult({
    kind: "passed",
    exitCode: 0,
    processName: "playwright",
    code: 0,
    signal: null,
    phase: "playwright",
    cause: "Playwright terminó correctamente.",
    warnings: []
  }, logger);

  assert.deepEqual(lines, [
    "",
    "E2E PASSED",
    "- Playwright terminó 0.",
    "- Servicios se cerraron por el runner.",
    "- SIGTERM esperado no se considera fallo."
  ]);
});

function createHarness(options = {}) {
  const children = [];
  const signals = [];
  const interruptController = new InterruptController();
  const behaviorByCommand = new Map([
    ["api-command", options.api],
    ["web-command", options.web],
    ["playwright-command", options.playwright]
  ]);
  const spawn = (command) => {
    const child = new FakeChild(command);
    children.push(child);
    const behavior = behaviorByCommand.get(command);
    if (behavior) queueMicrotask(() => behavior(child));
    return child;
  };
  const supervisor = new ProcessSupervisor({
    spawn,
    gracefulTimeoutMs: 1,
    forceTimeoutMs: 1,
    logger: { log: () => undefined, error: () => undefined, warn: () => undefined },
    signalProcessTree: (managed, signal) => {
      signals.push([managed.label, signal]);
      if (signal === "SIGTERM" && options.ignoreSigtermFor?.has(managed.label)) return;
      managed.child.finish(null, signal);
    }
  });

  const harness = {
    interruptController,
    signals,
    activeProcesses: () => children.filter((child) => !child.finished),
    run: () => executeE2ELifecycle({
      supervisor,
      interruptController,
      prepare: async () => undefined,
      startApi: async () => supervisor.start({ label: "api", command: "api-command" }),
      waitForApi: options.waitForApi ?? (async () => undefined),
      startWeb: async () => supervisor.start({ label: "web", command: "web-command" }),
      waitForWeb: options.waitForWeb ?? (async () => undefined),
      startPlaywright: async () => supervisor.start({
        label: "playwright",
        role: "test",
        command: "playwright-command"
      })
    })
  };
  return harness;
}

let nextPid = 20_000;

class FakeChild extends EventEmitter {
  constructor(command) {
    super();
    this.command = command;
    this.pid = nextPid;
    nextPid += 1;
    this.exitCode = null;
    this.signalCode = null;
    this.finished = false;
  }

  finish(code, signal) {
    if (this.finished) return;
    this.finished = true;
    this.exitCode = code;
    this.signalCode = signal;
    this.emit("exit", code, signal);
  }

  kill(signal) {
    this.finish(null, signal);
    return true;
  }
}
