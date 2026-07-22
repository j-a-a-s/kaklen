#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function verifyInfrastructureSecurity(options = {}) {
  const root = options.root ?? defaultRoot;
  const infraRoot = resolve(root, "infra");
  const terraformFiles = walk(infraRoot).filter((path) =>
    [".tf", ".tfvars", ".hcl"].includes(extname(path)) || path.endsWith(".tfvars.example") || path.endsWith(".hcl.example")
  );
  const terraform = terraformFiles.map((path) => readFileSync(path, "utf8")).join("\n");
  const tfvarsPath = resolve(infraRoot, "environments/staging/terraform.tfvars.example");
  const workflowPath = resolve(root, ".github/workflows/infrastructure.yml");
  const viewerPath = resolve(infraRoot, "modules/storage/viewer-request.js");
  const workflow = readFileSync(workflowPath, "utf8");
  const tfvars = readFileSync(tfvarsPath, "utf8");
  const viewer = readFileSync(viewerPath, "utf8");
  const scripts = [
    "scripts/infra.mjs",
    "scripts/infra-runner-core.mjs",
    "scripts/write-infrastructure-ci-evidence.mjs"
  ].map((path) => readFileSync(resolve(root, path), "utf8")).join("\n");

  const findings = evaluateSecuritySources({ terraform, workflow, scripts, tfvars, viewer });
  const requiredFiles = [
    "infra/environments/staging/main.tf",
    "infra/environments/staging/backend.hcl.example",
    "infra/modules/networking/main.tf",
    "infra/modules/security/main.tf",
    "infra/modules/load-balancer/main.tf",
    "infra/modules/ecs/main.tf",
    "infra/modules/rds/main.tf",
    "infra/modules/redis/main.tf",
    "infra/modules/storage/main.tf",
    "infra/modules/secrets/main.tf",
    "infra/modules/observability/main.tf"
  ];
  const available = new Set(terraformFiles.map((path) => relative(root, path).split("\\").join("/")));
  for (const path of requiredFiles) {
    if (!available.has(path)) findings.push(`Required infrastructure file is missing: ${path}`);
  }

  const checks = {
    privateDatabase: !findings.some((finding) => finding.includes("RDS")),
    privateRedis: !findings.some((finding) => finding.includes("Redis")),
    encryptedStorage: !findings.some((finding) => finding.includes("encryption")),
    privateBuckets: !findings.some((finding) => finding.includes("bucket")),
    scopedIam: !findings.some((finding) => finding.includes("IAM")),
    secretHygiene: !findings.some((finding) => finding.includes("secret") || finding.includes("credential")),
    safePipeline: !findings.some((finding) => finding.includes("workflow"))
  };
  const result = {
    generatedAt: new Date().toISOString(),
    status: findings.length === 0 ? "PASS" : "FAIL",
    terraformFiles: terraformFiles.length,
    checks,
    findings
  };

  if (options.writeArtifact !== false) {
    const artifactPath = options.artifactPath ?? resolve(root, "artifacts/infrastructure-security.json");
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, `${JSON.stringify(result, null, 2)}\n`);
  }

  return result;
}

export function evaluateSecuritySources({ terraform, workflow, scripts, tfvars, viewer }) {
  const findings = [];
  requirePattern(terraform, /publicly_accessible\s*=\s*false/, "RDS must explicitly disable public access.", findings);
  requirePattern(terraform, /storage_encrypted\s*=\s*true/, "RDS storage encryption is missing.", findings);
  requirePattern(terraform, /at_rest_encryption_enabled\s*=\s*true/, "Redis at-rest encryption is missing.", findings);
  requirePattern(terraform, /transit_encryption_enabled\s*=\s*true/, "Redis transit encryption is missing.", findings);
  requirePattern(terraform, /referenced_security_group_id\s*=\s*aws_security_group\.ecs\.id[\s\S]*from_port\s*=\s*5432/, "RDS ingress is not restricted to ECS.", findings);
  requirePattern(terraform, /referenced_security_group_id\s*=\s*aws_security_group\.ecs\.id[\s\S]*from_port\s*=\s*6379/, "Redis ingress is not restricted to ECS.", findings);
  requirePattern(terraform, /assign_public_ip\s*=\s*false/, "ECS tasks must not receive public IP addresses.", findings);
  requirePattern(terraform, /deployment_circuit_breaker\s*{[\s\S]*rollback\s*=\s*true/, "ECS automatic deployment rollback is missing.", findings);
  requirePattern(terraform, /block_public_acls\s*=\s*true[\s\S]*block_public_policy\s*=\s*true[\s\S]*ignore_public_acls\s*=\s*true[\s\S]*restrict_public_buckets\s*=\s*true/, "S3 bucket public access controls are incomplete.", findings);
  requirePattern(terraform, /sse_algorithm\s*=\s*each\.key\s*==\s*"application"\s*\?\s*"aws:kms"\s*:\s*"AES256"/, "S3 encryption policy is missing.", findings);
  requirePattern(terraform, /enable_key_rotation\s*=\s*true/, "Application object KMS key rotation is missing.", findings);
  requirePattern(terraform, /manage_master_user_password\s*=\s*true/, "RDS credentials must be managed by AWS.", findings);
  requirePattern(terraform, /use_lockfile\s*=\s*true/, "Remote state locking is not documented in the backend example.", findings);
  requirePattern(terraform, /encrypt\s*=\s*true/, "Remote state encryption is not documented in the backend example.", findings);
  requirePattern(viewer, /lastSegment\.indexOf\("\."\) === -1/, "Localized routing must preserve asset requests with extensions.", findings);

  if (/actions\s*=\s*\[\s*"\*"\s*\]/.test(terraform) || /Action\s*=\s*"\*"/.test(terraform)) {
    findings.push("IAM actions contain a global wildcard.");
  }
  if (/s3:\*/i.test(terraform)) findings.push("IAM contains a prohibited s3 wildcard.");

  const globalResourceMatches = [...terraform.matchAll(/resources\s*=\s*\[\s*"\*"\s*\]/g)];
  if (globalResourceMatches.length !== 1) {
    findings.push("IAM must contain exactly one technical global resource exception.");
  } else {
    const index = globalResourceMatches[0].index ?? 0;
    const context = terraform.slice(Math.max(0, index - 220), index + 100);
    if (!context.includes("EcrAuthorization") || !context.includes("ecr:GetAuthorizationToken")) {
      findings.push("IAM global resource exception is not limited to ECR authorization.");
    }
  }

  if (/resource\s+"aws_secretsmanager_secret_version"/.test(terraform)) {
    findings.push("Terraform must not place application secret values in state.");
  }
  if (/^\s*(?:DATABASE_URL|REDIS_URL|JWT_ACCESS_SECRET|JWT_REFRESH_SECRET|PAYMENT_SANDBOX_SECRET|RATE_LIMIT_HASH_SECRET)\s*=/m.test(tfvars)) {
    findings.push("The staging variable example contains a secret assignment.");
  }
  if (/\bAKIA[0-9A-Z]{16}\b/.test(terraform + workflow + scripts + tfvars)) {
    findings.push("An AWS access credential was detected.");
  }
  if (/\b(?!0{12}\b)\d{12}\b/.test(tfvars)) {
    findings.push("The staging variable example contains a non-placeholder AWS account identifier.");
  }

  const internalGlobalIngress = [...terraform.matchAll(/resource\s+"aws_vpc_security_group_ingress_rule"\s+"(rds|redis)[^"]*"\s*{[\s\S]*?\n}/g)]
    .some((match) => /cidr_ipv4\s*=\s*"0\.0\.0\.0\/0"/.test(match[0]));
  if (internalGlobalIngress) findings.push("RDS or Redis has global ingress.");

  if (/terraform\s+apply/i.test(workflow) || /terraform\s+apply/i.test(scripts)) {
    findings.push("Infrastructure workflow or scripts contain a deployment command.");
  }
  if (/continue-on-error\s*:\s*true/.test(workflow)) {
    findings.push("Infrastructure workflow suppresses a required control failure.");
  }
  requirePattern(workflow, /submodules:\s*recursive/, "Infrastructure workflow must checkout submodules recursively.", findings);
  requirePattern(workflow, /pnpm infra:fmt/, "Infrastructure workflow does not execute formatting validation.", findings);
  requirePattern(workflow, /pnpm infra:validate/, "Infrastructure workflow does not execute Terraform validation.", findings);
  requirePattern(workflow, /pnpm infra:lint/, "Infrastructure workflow does not execute TFLint.", findings);
  requirePattern(workflow, /pnpm infra:security/, "Infrastructure workflow does not execute infrastructure security scanning.", findings);

  return findings;
}

function requirePattern(source, pattern, message, findings) {
  if (!pattern.test(source)) findings.push(message);
}

function walk(directory) {
  const paths = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) paths.push(...walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = verifyInfrastructureSecurity();
  if (result.status !== "PASS") {
    console.error("INFRASTRUCTURE SECURITY FAILED");
    result.findings.forEach((finding) => console.error(`- ${finding}`));
    process.exit(1);
  }
  console.log(`✓ Infrastructure structural security passed (${result.terraformFiles} Terraform files)`);
}
