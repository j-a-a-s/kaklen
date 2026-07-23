import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import {
  InfrastructureCommandError,
  infrastructureCommands,
  REPO_ROOT,
  runInfrastructureSteps,
  terraformDirectories,
} from "./infra-runner-core.mjs";
import { evaluateSecuritySources, verifyInfrastructureSecurity } from "./verify-infrastructure-security.mjs";
import { verifyInfrastructureEnvironmentContract } from "./verify-infrastructure-environment-contract.mjs";
import { evaluateTrivyReport } from "./evaluate-infrastructure-trivy.mjs";

test("infrastructure command interface executes real tools", () => {
  assert.equal(infrastructureCommands("fmt")[0].command, "terraform");
  assert.ok(infrastructureCommands("validate").some((step) => step.args.includes("validate")));
  assert.ok(infrastructureCommands("lint").every((step) => step.command === "tflint"));
  assert.ok(infrastructureCommands("security").some((step) => step.command === "trivy"));
  assert.ok(infrastructureCommands("plan:staging").some((step) => step.args.includes("plan")));
  assert.throws(() => infrastructureCommands("deploy"), /Unknown infrastructure command/);
});

test("infrastructure runner returns an exit code and removes temporary plans", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "kaklen-infra-runner-"));
  const planPath = resolve(root, "staging.tfplan");
  writeFileSync(planPath, "temporary plan");

  const result = await runInfrastructureSteps([
    {
      args: ["-e", "process.exit(0)"],
      command: process.execPath,
      cwd: root,
      phase: "fixture-success",
      timeoutMs: 2_000,
    },
  ], {
    action: "plan:staging",
    root,
    temporaryFiles: [planPath],
  });

  assert.equal(result.exitCode, 0);
  assert.equal(existsSync(planPath), false);
});

test("infrastructure timeout fails and terminates the command", async () => {
  const root = mkdtempSync(resolve(tmpdir(), "kaklen-infra-timeout-"));
  await assert.rejects(
    runInfrastructureSteps([
      {
        args: ["-e", 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'],
        command: process.execPath,
        cwd: root,
        phase: "fixture-timeout",
        timeoutMs: 100,
      },
    ], { action: "plan:staging", root }),
    (error) => {
      assert.ok(error instanceof InfrastructureCommandError);
      assert.equal(error.exitCode, 124);
      assert.equal(error.timedOut, true);
      return true;
    },
  );
});

test("a clean-clone lint generates Prisma Client first", () => {
  const packageJson = JSON.parse(readFileSync(resolve(REPO_ROOT, "package.json"), "utf8"));
  assert.equal(packageJson.scripts.prelint, "pnpm prisma:generate");
});

test("all Terraform modules are independently linted", () => {
  const directories = terraformDirectories(resolve(REPO_ROOT, "infra"));
  const expected = ["ecs", "load-balancer", "networking", "observability", "rds", "redis", "secrets", "security", "storage"];
  for (const module of expected) assert.ok(directories.some((directory) => directory.endsWith(`/modules/${module}`)));
  assert.ok(directories.some((directory) => directory.endsWith("/environments/staging")));
});

test("infrastructure workflow watches every infrastructure control script", () => {
  const workflow = readFileSync(resolve(REPO_ROOT, ".github/workflows/infrastructure.yml"), "utf8");
  assert.match(workflow, /scripts\/\*infrastructure\*\.mjs/g);
  assert.equal(workflow.match(/scripts\/\*infrastructure\*\.mjs/g)?.length, 2);
});

test("AWS environment mapping remains synchronized and protects secret destinations", () => {
  const { result } = verifyInfrastructureEnvironmentContract({ writeArtifact: false });
  assert.equal(result.status, "PASS", result.errors.join("\n"));
  assert.equal(result.canonicalVariables, 50);
});

test("infrastructure structural security invariants pass", () => {
  const result = verifyInfrastructureSecurity({ writeArtifact: false });
  assert.equal(result.status, "PASS", result.findings.join("\n"));
});

test("security scan rejects global IAM actions and deployment commands", () => {
  const findings = evaluateSecuritySources({
    terraform: 'actions = ["*"]',
    workflow: "terraform apply",
    scripts: "",
    tfvars: "DATABASE_URL = \"plaintext\"",
    viewer: ""
  });
  assert.ok(findings.some((finding) => finding.includes("IAM actions")));
  assert.ok(findings.some((finding) => finding.includes("deployment command")));
  assert.ok(findings.some((finding) => finding.includes("secret assignment")));
});

test("staging examples contain placeholders instead of deployable account data", () => {
  const source = readFileSync(resolve(REPO_ROOT, "infra/environments/staging/terraform.tfvars.example"), "utf8");
  assert.match(source, /000000000000/);
  assert.doesNotMatch(source, /\b(?!0{12}\b)\d{12}\b/);
  assert.doesNotMatch(source, /AWS_SECRET_ACCESS_KEY|JWT_ACCESS_SECRET\s*=/);
});

test("Trivy evaluator reports the intentional public ALB and rejects other findings", () => {
  const accepted = evaluateTrivyReport({
    Results: [{
      Target: "modules/load-balancer/main.tf",
      Misconfigurations: [{ AVDID: "AVD-AWS-0053", Severity: "HIGH", Title: "Load balancer is exposed publicly." }]
    }]
  });
  assert.equal(accepted.status, "PASS");
  assert.equal(accepted.acceptedDesignFindings.length, 1);

  const rejected = evaluateTrivyReport({
    Results: [{
      Target: "modules/storage/main.tf",
      Misconfigurations: [{ AVDID: "AVD-AWS-0011", Severity: "HIGH", Title: "Distribution does not utilize a WAF." }]
    }]
  });
  assert.equal(rejected.status, "FAIL");
  assert.equal(rejected.failures.length, 1);
});

test("Trivy evaluator narrows false-positive acceptance to exact Kaklen controls", () => {
  const accepted = evaluateTrivyReport({
    Results: [{
      Target: "modules/ecs/main.tf",
      Misconfigurations: [{
        ID: "AWS-0036",
        Severity: "CRITICAL",
        Title: "Task definition defines sensitive environment variable(s).",
        Message: "environment variable name PASSWORD_RESET_EXPIRES_MINUTES"
      }]
    }]
  });
  assert.equal(accepted.status, "PASS");

  const rejected = evaluateTrivyReport({
    Results: [{
      Target: "modules/ecs/main.tf",
      Misconfigurations: [{
        ID: "AWS-0036",
        Severity: "CRITICAL",
        Title: "Task definition defines sensitive environment variable(s).",
        Message: "environment variable name DATABASE_PASSWORD"
      }]
    }]
  });
  assert.equal(rejected.status, "FAIL");
});
