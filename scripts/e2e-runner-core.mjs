import { spawn as nodeSpawn } from "node:child_process";
import { randomBytes } from "node:crypto";

export const E2E_EXIT_CODES = Object.freeze({
  passed: 0,
  failed: 1,
  infrastructure: 2,
  SIGINT: 130,
  SIGTERM: 143
});

export function createE2ERateLimitSecret() {
  return randomBytes(32).toString("hex");
}

export function normalizePlaywrightArguments(argumentsList) {
  return argumentsList[0] === "--" ? argumentsList.slice(1) : [...argumentsList];
}

export class E2EInfrastructureError extends Error {
  constructor({ processName, phase, cause, code = null, signal = null, exitCode = E2E_EXIT_CODES.infrastructure }) {
    super(cause);
    this.name = "E2EInfrastructureError";
    this.processName = processName;
    this.phase = phase;
    this.code = code;
    this.signal = signal;
    this.exitCode = exitCode;
  }
}

export class InterruptController {
  constructor() {
    this.signal = null;
    this.promise = new Promise((resolveInterrupt) => {
      this.resolveInterrupt = resolveInterrupt;
    });
  }

  request(signal) {
    if (this.signal) return;
    this.signal = signal;
    this.resolveInterrupt(signal);
  }
}

export class ProcessSupervisor {
  constructor({
    spawn = nodeSpawn,
    logger = console,
    platform = process.platform,
    gracefulTimeoutMs = 5_000,
    forceTimeoutMs = 2_000,
    signalProcessTree
  } = {}) {
    this.spawn = spawn;
    this.logger = logger;
    this.platform = platform;
    this.gracefulTimeoutMs = gracefulTimeoutMs;
    this.forceTimeoutMs = forceTimeoutMs;
    this.signalProcessTree = signalProcessTree ?? ((managed, signal) => defaultSignalProcessTree(managed, signal, platform));
    this.phase = "initialization";
    this.processes = [];
    this.shutdownRequestedByRunner = false;
    this.unexpectedFailure = new Promise((resolveFailure) => {
      this.resolveUnexpectedFailure = resolveFailure;
    });
  }

  setPhase(phase) {
    this.phase = phase;
  }

  start({ label, command, args = [], cwd = process.cwd(), env = process.env, role = "service", stdio = "inherit" }) {
    let child;
    try {
      child = this.spawn(command, args, {
        cwd,
        env,
        stdio,
        shell: false,
        detached: this.platform !== "win32"
      });
    } catch (error) {
      throw infrastructureError(error, label, this.phase, "No fue posible iniciar el proceso");
    }

    const managed = {
      label,
      role,
      child,
      shutdownRequestedByRunner: this.shutdownRequestedByRunner,
      outcome: null,
      exitPromise: null,
      resolveExit: null
    };
    managed.exitPromise = new Promise((resolveExit) => {
      managed.resolveExit = resolveExit;
    });
    this.processes.push(managed);

    const settle = (outcome) => {
      if (managed.outcome) return;
      managed.outcome = outcome;
      managed.resolveExit(outcome);
      if (managed.role === "service" && !managed.shutdownRequestedByRunner) {
        this.resolveUnexpectedFailure(
          new E2EInfrastructureError({
            processName: managed.label,
            phase: this.phase,
            cause: outcome.error?.message ?? "El servicio terminó antes de tiempo.",
            code: outcome.code,
            signal: outcome.signal
          })
        );
      }
    };

    child.once("error", (error) => settle({ code: null, signal: null, error }));
    child.once("exit", (code, signal) => settle({ code, signal, error: null }));
    return managed;
  }

  beginShutdown() {
    this.shutdownRequestedByRunner = true;
    for (const managed of this.processes) {
      managed.shutdownRequestedByRunner = true;
    }
  }

  async stop(managed) {
    if (managed.outcome) {
      return { forced: false, materialError: null };
    }

    managed.shutdownRequestedByRunner = true;
    let signalError = null;
    try {
      this.signalProcessTree(managed, "SIGTERM");
    } catch (error) {
      signalError = error;
    }

    if (await waitForOutcome(managed, this.gracefulTimeoutMs)) {
      return { forced: false, materialError: null };
    }

    this.logger.warn(`[e2e:cleanup] ${managed.label} no terminó con SIGTERM; se enviará SIGKILL.`);
    try {
      this.signalProcessTree(managed, "SIGKILL");
    } catch (error) {
      signalError ??= error;
    }

    if (await waitForOutcome(managed, this.forceTimeoutMs)) {
      return { forced: true, materialError: null };
    }

    const detail = signalError instanceof Error ? ` ${signalError.message}` : "";
    return {
      forced: true,
      materialError: new E2EInfrastructureError({
        processName: managed.label,
        phase: "cleanup",
        cause: `El proceso no terminó después de SIGKILL.${detail}`.trim()
      })
    };
  }

  async cleanup() {
    this.beginShutdown();
    const warnings = [];
    const errors = [];
    for (const managed of [...this.processes].reverse()) {
      const outcome = await this.stop(managed);
      if (outcome.forced) {
        warnings.push(`${managed.label} requirió SIGKILL.`);
      }
      if (outcome.materialError) {
        errors.push(outcome.materialError);
      }
    }
    return { warnings, errors };
  }
}

export async function executeE2ELifecycle({
  supervisor,
  interruptController,
  prepare,
  startApi,
  waitForApi,
  startWeb,
  waitForWeb,
  startPlaywright,
  cleanupEnvironment
}) {
  let result = null;
  let cleanupReport = { warnings: [], errors: [] };

  try {
    await runGuardedStage("prepare", prepare, supervisor, interruptController);
    await runGuardedStage("api-start", startApi, supervisor, interruptController);
    await runGuardedStage("api-health", waitForApi, supervisor, interruptController);
    await runGuardedStage("web-start", startWeb, supervisor, interruptController);
    await runGuardedStage("web-health", waitForWeb, supervisor, interruptController);

    supervisor.setPhase("playwright");
    const playwright = await runGuardedStage("playwright-start", startPlaywright, supervisor, interruptController);
    const winner = await Promise.race([
      playwright.exitPromise.then((outcome) => ({ type: "playwright", outcome })),
      supervisor.unexpectedFailure.then((error) => ({ type: "infrastructure", error })),
      interruptController.promise.then((signal) => ({ type: "interrupt", signal }))
    ]);

    if (winner.type === "infrastructure") throw winner.error;
    if (winner.type === "interrupt") throw interruptionError(winner.signal, "playwright");

    supervisor.beginShutdown();
    result = resultFromPlaywright(winner.outcome);
  } catch (error) {
    result = resultFromInfrastructureError(error, supervisor.phase);
  } finally {
    supervisor.setPhase("cleanup");
    supervisor.beginShutdown();
    cleanupReport = await supervisor.cleanup();
    if (cleanupEnvironment) {
      try {
        await cleanupEnvironment();
      } catch (error) {
        cleanupReport.errors.push(infrastructureError(error, "environment", "cleanup", "Falló la limpieza del entorno"));
      }
    }
  }

  return applyCleanupReport(result, cleanupReport);
}

export function printE2EResult(result, logger = console) {
  logger.log("");
  if (result.kind === "passed") {
    logger.log("E2E PASSED");
    logger.log("- Playwright terminó 0.");
    logger.log("- Servicios se cerraron por el runner.");
    logger.log("- SIGTERM esperado no se considera fallo.");
  } else if (result.kind === "failed") {
    logger.error("E2E FAILED");
    printFailureDetails(result, logger);
  } else {
    logger.error("E2E INFRASTRUCTURE FAILED");
    printFailureDetails(result, logger);
  }
  for (const warning of result.warnings) {
    logger.warn(`[e2e:cleanup] ${warning}`);
  }
}

async function runGuardedStage(phase, operation, supervisor, interruptController) {
  supervisor.setPhase(phase);
  const winner = await Promise.race([
    Promise.resolve()
      .then(operation)
      .then((value) => ({ type: "completed", value }), (error) => ({ type: "error", error })),
    supervisor.unexpectedFailure.then((error) => ({ type: "infrastructure", error })),
    interruptController.promise.then((signal) => ({ type: "interrupt", signal }))
  ]);
  if (winner.type === "completed") return winner.value;
  if (winner.type === "infrastructure") throw winner.error;
  if (winner.type === "interrupt") throw interruptionError(winner.signal, phase);
  throw infrastructureError(winner.error, processNameForPhase(phase), phase, "Falló una fase del runner");
}

function resultFromPlaywright(outcome) {
  if (outcome.error) {
    return resultFromInfrastructureError(
      new E2EInfrastructureError({
        processName: "playwright",
        phase: "playwright",
        cause: outcome.error.message
      }),
      "playwright"
    );
  }
  if (outcome.code === 0 && !outcome.signal) {
    return {
      kind: "passed",
      exitCode: E2E_EXIT_CODES.passed,
      processName: "playwright",
      code: 0,
      signal: null,
      phase: "playwright",
      cause: "Playwright terminó correctamente.",
      warnings: []
    };
  }
  return {
    kind: "failed",
    exitCode: outcome.code ?? exitCodeForSignal(outcome.signal),
    processName: "playwright",
    code: outcome.code,
    signal: outcome.signal,
    phase: "playwright",
    cause: outcome.signal
      ? `Playwright terminó por señal ${outcome.signal}.`
      : `Playwright terminó con código ${outcome.code ?? E2E_EXIT_CODES.failed}.`,
    warnings: []
  };
}

function resultFromInfrastructureError(error, fallbackPhase) {
  const failure = error instanceof E2EInfrastructureError
    ? error
    : infrastructureError(error, processNameForPhase(fallbackPhase), fallbackPhase, "Falló la infraestructura E2E");
  return {
    kind: "infrastructure",
    exitCode: failure.exitCode,
    processName: failure.processName,
    code: failure.code,
    signal: failure.signal,
    phase: failure.phase,
    cause: failure.message,
    warnings: []
  };
}

function applyCleanupReport(result, cleanupReport) {
  const warnings = [...result.warnings, ...cleanupReport.warnings];
  if (cleanupReport.errors.length === 0) {
    return { ...result, warnings };
  }
  const cleanupCause = cleanupReport.errors.map((error) => `${error.processName}: ${error.message}`).join("; ");
  if (result.kind !== "passed") {
    return { ...result, warnings: [...warnings, `Fallo material de cleanup: ${cleanupCause}`] };
  }
  return {
    kind: "infrastructure",
    exitCode: E2E_EXIT_CODES.infrastructure,
    processName: "cleanup",
    code: null,
    signal: null,
    phase: "cleanup",
    cause: cleanupCause,
    warnings
  };
}

function infrastructureError(error, processName, phase, prefix) {
  const detail = error instanceof Error ? error.message : String(error);
  return new E2EInfrastructureError({ processName, phase, cause: `${prefix}: ${detail}` });
}

function interruptionError(signal, phase) {
  return new E2EInfrastructureError({
    processName: "runner",
    phase,
    cause: `Interrupción solicitada mediante ${signal}.`,
    signal,
    exitCode: E2E_EXIT_CODES[signal] ?? E2E_EXIT_CODES.infrastructure
  });
}

function processNameForPhase(phase) {
  if (phase.startsWith("api")) return "api";
  if (phase.startsWith("web")) return "web";
  if (phase.startsWith("playwright")) return "playwright";
  return "runner";
}

function printFailureDetails(result, logger) {
  logger.error(`Proceso: ${result.processName}`);
  logger.error(`Código: ${result.code ?? "n/a"}`);
  logger.error(`Señal: ${result.signal ?? "n/a"}`);
  logger.error(`Fase: ${result.phase}`);
  logger.error(`Causa: ${result.cause}`);
}

function exitCodeForSignal(signal) {
  return E2E_EXIT_CODES[signal] ?? E2E_EXIT_CODES.failed;
}

function waitForOutcome(managed, timeoutMs) {
  if (managed.outcome) return Promise.resolve(true);
  return new Promise((resolveWait) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolveWait(value);
    };
    const timer = setTimeout(() => finish(false), timeoutMs);
    managed.exitPromise.then(() => finish(true));
  });
}

function defaultSignalProcessTree(managed, signal, platform) {
  const child = managed.child;
  if (!child.pid || managed.outcome) return;
  if (platform === "win32") {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if (error?.code === "ESRCH") return;
    child.kill(signal);
  }
}
