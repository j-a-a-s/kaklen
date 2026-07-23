import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runSupervisedProcess } from "./process-supervisor.mjs";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const STAGING_ROOT = resolve(REPO_ROOT, "infra/environments/staging");

export function infrastructureCommands(action, root = REPO_ROOT, env = process.env) {
  const stagingRoot = resolve(root, "infra/environments/staging");
  const configPath = resolve(root, ".tflint.hcl");
  const tfvarsPath = resolve(stagingRoot, "terraform.tfvars.example");
  const planPath = resolve(root, ".artifacts/infra/staging.tfplan");
  const timeout = infrastructureTimeouts(env);

  switch (action) {
    case "fmt":
      return [step("terraform-fmt", "terraform", ["fmt", "-check", "-recursive", resolve(root, "infra")], root, timeout.step)];
    case "validate":
      return [
        step("environment-contract", "node", ["scripts/verify-infrastructure-environment-contract.mjs"], root, timeout.step),
        step("terraform-init-validation", "terraform", ["init", "-backend=false", "-input=false"], stagingRoot, timeout.init),
        step("terraform-validate", "terraform", ["validate", "-no-color"], stagingRoot, timeout.step)
      ];
    case "lint":
      return [
        step("tflint-init", "tflint", ["--init", `--config=${configPath}`], root, timeout.init),
        ...terraformDirectories(resolve(root, "infra")).map((directory) => ({
          phase: `tflint-${directory.split("/").at(-1)}`,
          command: "tflint",
          args: [`--config=${configPath}`, `--chdir=${directory}`],
          cwd: root,
          timeoutMs: timeout.step
        }))
      ];
    case "security":
      return [
        step("infrastructure-security-contract", "node", ["scripts/verify-infrastructure-security.mjs"], root, timeout.step),
        {
          phase: "trivy-infrastructure",
          command: "trivy",
          args: [
            "config",
            "--format",
            "json",
            "--output",
            resolve(root, ".artifacts/infra/trivy.json"),
            "--severity",
            "HIGH,CRITICAL",
            "--tf-vars",
            tfvarsPath,
            resolve(root, "infra")
          ],
          cwd: root,
          timeoutMs: timeout.security
        },
        step("trivy-evaluation", "node", ["scripts/evaluate-infrastructure-trivy.mjs"], root, timeout.step)
      ];
    case "plan:staging":
      return [
        step("terraform-init-staging", "terraform", ["init", "-backend=false", "-input=false"], stagingRoot, timeout.init),
        step("terraform-validate-staging", "terraform", ["validate", "-no-color"], stagingRoot, timeout.step),
        {
          phase: "terraform-plan-staging",
          command: "terraform",
          args: ["plan", "-input=false", "-lock=false", "-refresh=false", "-no-color", `-var-file=${tfvarsPath}`, `-out=${planPath}`],
          cwd: stagingRoot,
          env: offlineAwsEnvironment(),
          timeoutMs: timeout.plan
        },
        {
          phase: "terraform-show-staging",
          command: "terraform",
          args: ["show", "-no-color", planPath],
          cwd: stagingRoot,
          capturePath: resolve(root, ".artifacts/infra/staging-plan.txt"),
          timeoutMs: timeout.step
        }
      ];
    default:
      throw new Error(`Unknown infrastructure command: ${action}`);
  }
}

export async function runInfrastructureCommand(action, options = {}) {
  const root = options.root ?? REPO_ROOT;
  const env = options.env ?? process.env;
  const commands = infrastructureCommands(action, root, env);
  const temporaryFiles = action === "plan:staging"
    ? [resolve(root, ".artifacts/infra/staging.tfplan")]
    : [];

  return runInfrastructureSteps(commands, {
    ...options,
    action,
    env,
    root,
    temporaryFiles,
  });
}

export async function runInfrastructureSteps(commands, options = {}) {
  const root = options.root ?? REPO_ROOT;
  const action = options.action ?? "custom";
  const env = options.env ?? process.env;
  const execute = options.execute ?? runSupervisedProcess;
  const startedAt = Date.now();
  const results = [];
  const diagnosticsRoot = resolve(root, ".artifacts/infra/diagnostics");
  mkdirSync(resolve(root, ".artifacts/infra"), { recursive: true });

  try {
    for (let index = 0; index < commands.length; index += 1) {
      const commandStep = commands[index];
      const phase = `infra:${action}:${commandStep.phase ?? `${commandStep.command}-${index + 1}`}`;
      const result = await execute({
        abortSignal: options.abortSignal,
        args: commandStep.args,
        captureStdout: Boolean(commandStep.capturePath),
        command: commandStep.command,
        cwd: commandStep.cwd,
        env: {
          ...env,
          ...nonInteractiveEnvironment(),
          ...commandStep.env,
        },
        logPath: resolve(diagnosticsRoot, `${String(index + 1).padStart(2, "0")}-${safeName(commandStep.phase ?? commandStep.command)}.log`),
        phase,
        teeStdout: !commandStep.capturePath,
        timeoutMs: commandStep.timeoutMs,
      });
      results.push(result);

      if (result.exitCode !== 0 || result.signal) {
        throw new InfrastructureCommandError(
          `${commandStep.command} ${commandStep.args.join(" ")} failed: ${result.cause}.`,
          result,
        );
      }
      if (commandStep.capturePath) {
        mkdirSync(dirname(commandStep.capturePath), { recursive: true });
        writeFileSync(commandStep.capturePath, result.stdout);
        console.log(`Plan evidence written to ${commandStep.capturePath}`);
      }
    }
  } finally {
    let removed = 0;
    for (const temporaryFile of options.temporaryFiles ?? []) {
      if (existsSync(temporaryFile)) {
        rmSync(temporaryFile, { force: true });
        removed += 1;
      }
    }
    console.log(`[CLEANUP] infra:${action} durationMs=${Date.now() - startedAt} temporaryFilesRemoved=${removed}`);
  }

  return {
    durationMs: Date.now() - startedAt,
    exitCode: 0,
    results,
  };
}

export class InfrastructureCommandError extends Error {
  constructor(message, result) {
    super(message);
    this.name = "InfrastructureCommandError";
    this.exitCode = result.exitCode ?? 1;
    this.signal = result.signal ?? null;
    this.timedOut = result.timedOut;
  }
}

export function terraformDirectories(infraRoot) {
  const directories = [];
  walk(infraRoot, directories);
  return directories.sort();
}

function walk(directory, directories) {
  const entries = readdirSync(directory, { withFileTypes: true });
  if (entries.some((entry) => entry.isFile() && entry.name.endsWith(".tf"))) directories.push(directory);
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name !== ".terraform") walk(join(directory, entry.name), directories);
  }
}

function offlineAwsEnvironment() {
  return {
    AWS_ACCESS_KEY_ID: "offline-validation",
    AWS_SECRET_ACCESS_KEY: "offline-validation",
    AWS_SESSION_TOKEN: "offline-validation",
    AWS_EC2_METADATA_DISABLED: "true"
  };
}

function step(phase, command, args, cwd, timeoutMs) {
  return { phase, command, args, cwd, timeoutMs };
}

function infrastructureTimeouts(env) {
  const stepTimeout = timeoutValue(env.INFRA_STEP_TIMEOUT_MS, 300_000, "INFRA_STEP_TIMEOUT_MS");
  return {
    init: timeoutValue(env.INFRA_INIT_TIMEOUT_MS, 600_000, "INFRA_INIT_TIMEOUT_MS"),
    plan: timeoutValue(env.INFRA_PLAN_TIMEOUT_MS, 300_000, "INFRA_PLAN_TIMEOUT_MS"),
    security: timeoutValue(env.INFRA_SECURITY_TIMEOUT_MS, 300_000, "INFRA_SECURITY_TIMEOUT_MS"),
    step: stepTimeout,
  };
}

function timeoutValue(value, fallback, name) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function nonInteractiveEnvironment() {
  return {
    CHECKPOINT_DISABLE: "1",
    TF_IN_AUTOMATION: "true",
    TF_INPUT: "0",
  };
}

function safeName(value) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}
