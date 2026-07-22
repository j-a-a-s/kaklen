import { spawnSync } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const STAGING_ROOT = resolve(REPO_ROOT, "infra/environments/staging");

export function infrastructureCommands(action, root = REPO_ROOT) {
  const stagingRoot = resolve(root, "infra/environments/staging");
  const configPath = resolve(root, ".tflint.hcl");
  const tfvarsPath = resolve(stagingRoot, "terraform.tfvars.example");
  const planPath = resolve(root, ".artifacts/infra/staging.tfplan");

  switch (action) {
    case "fmt":
      return [{ command: "terraform", args: ["fmt", "-check", "-recursive", resolve(root, "infra")], cwd: root }];
    case "validate":
      return [
        { command: "node", args: ["scripts/verify-infrastructure-environment-contract.mjs"], cwd: root },
        { command: "terraform", args: ["init", "-backend=false", "-input=false"], cwd: stagingRoot },
        { command: "terraform", args: ["validate", "-no-color"], cwd: stagingRoot }
      ];
    case "lint":
      return [
        { command: "tflint", args: ["--init", `--config=${configPath}`], cwd: root },
        ...terraformDirectories(resolve(root, "infra")).map((directory) => ({
          command: "tflint",
          args: [`--config=${configPath}`, `--chdir=${directory}`],
          cwd: root
        }))
      ];
    case "security":
      return [
        { command: "node", args: ["scripts/verify-infrastructure-security.mjs"], cwd: root },
        {
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
          cwd: root
        },
        { command: "node", args: ["scripts/evaluate-infrastructure-trivy.mjs"], cwd: root }
      ];
    case "plan:staging":
      return [
        { command: "terraform", args: ["init", "-reconfigure", "-input=false"], cwd: stagingRoot },
        { command: "terraform", args: ["validate", "-no-color"], cwd: stagingRoot },
        {
          command: "terraform",
          args: ["plan", "-input=false", "-lock=false", "-refresh=false", "-no-color", `-var-file=${tfvarsPath}`, `-out=${planPath}`],
          cwd: stagingRoot,
          env: offlineAwsEnvironment()
        },
        {
          command: "terraform",
          args: ["show", "-no-color", planPath],
          cwd: stagingRoot,
          capturePath: resolve(root, ".artifacts/infra/staging-plan.txt")
        }
      ];
    default:
      throw new Error(`Unknown infrastructure command: ${action}`);
  }
}

export function runInfrastructureCommand(action, options = {}) {
  const root = options.root ?? REPO_ROOT;
  const commands = infrastructureCommands(action, root);
  mkdirSync(resolve(root, ".artifacts/infra"), { recursive: true });

  for (const step of commands) {
    const result = spawnSync(step.command, step.args, {
      cwd: step.cwd,
      env: { ...process.env, ...step.env },
      encoding: step.capturePath ? "utf8" : undefined,
      stdio: step.capturePath ? ["ignore", "pipe", "inherit"] : "inherit"
    });
    if (result.error) {
      throw new Error(`${step.command} is unavailable: ${result.error.message}`);
    }
    if (result.status !== 0) {
      throw new Error(`${step.command} ${step.args.join(" ")} failed with exit code ${result.status ?? 1}.`);
    }
    if (step.capturePath) {
      mkdirSync(dirname(step.capturePath), { recursive: true });
      writeFileSync(step.capturePath, result.stdout ?? "");
      console.log(`✓ Plan evidence written to ${step.capturePath}`);
    }
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
