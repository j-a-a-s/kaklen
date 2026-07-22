#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const canonicalPath = resolve(repoRoot, "docs/configuration/environment-variables.json");
const mappingPath = resolve(repoRoot, "infra/environment-mapping.json");
const documentPath = resolve(repoRoot, "docs/aws/ENVIRONMENT_MATRIX.md");
const artifactPath = resolve(repoRoot, "artifacts/infrastructure-environment-contract.json");

export function verifyInfrastructureEnvironmentContract(options = {}) {
  const canonical = JSON.parse(readFileSync(options.canonicalPath ?? canonicalPath, "utf8"));
  const mapping = JSON.parse(readFileSync(options.mappingPath ?? mappingPath, "utf8"));
  const variables = canonical.variables
    .filter((variable) => variable.scope === "runtime" && variable.availableIn.includes("production"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const errors = [];
  const expectedNames = new Set(variables.map((variable) => variable.name));

  for (const variable of variables) {
    const entry = mapping[variable.name];
    if (!entry) {
      errors.push(`Missing AWS mapping for ${variable.name}.`);
      continue;
    }
    for (const field of ["source", "suppliedBy", "ecsDestination", "frontendDestination", "notes"]) {
      if (typeof entry[field] !== "string" || entry[field].trim() === "") {
        errors.push(`${variable.name} has an invalid ${field}.`);
      }
    }
    if (typeof entry.terraformGenerated !== "boolean") {
      errors.push(`${variable.name} must declare terraformGenerated as a boolean.`);
    }
    if (variable.secret && entry.ecsDestination === "plain environment") {
      errors.push(`${variable.name} is secret and cannot use a plain ECS destination.`);
    }
    if (variable.secret && !["prohibited", "not used"].includes(entry.frontendDestination)) {
      errors.push(`${variable.name} is secret and cannot have a frontend destination.`);
    }
  }

  for (const name of Object.keys(mapping)) {
    if (!expectedNames.has(name)) errors.push(`AWS mapping contains unknown production runtime variable ${name}.`);
  }

  const requiredCoverage = [
    "DATABASE_URL",
    "REDIS_URL",
    "AWS_REGION",
    "AWS_S3_BUCKET",
    "AWS_CLOUDFRONT_DOMAIN",
    "APP_PUBLIC_URL",
    "APP_WEB_URL",
    "CORS_ALLOWED_ORIGINS",
    "AUTH_ALLOWED_ORIGINS",
    "PAYMENT_SANDBOX_SECRET",
    "RATE_LIMIT_HASH_SECRET"
  ];
  for (const name of requiredCoverage) {
    if (!mapping[name]) errors.push(`Required AWS variable ${name} is not covered.`);
  }

  const markdown = renderMatrix(variables, mapping);
  const outputDocument = options.documentPath ?? documentPath;
  if (options.writeDocument) {
    mkdirSync(dirname(outputDocument), { recursive: true });
    writeFileSync(outputDocument, markdown);
  } else if (readFileSync(outputDocument, "utf8") !== markdown) {
    errors.push("docs/aws/ENVIRONMENT_MATRIX.md is not synchronized with the canonical contract.");
  }

  const result = {
    status: errors.length === 0 ? "PASS" : "FAIL",
    canonicalVariables: variables.length,
    mappedVariables: Object.keys(mapping).length,
    errors
  };

  if (options.writeArtifact !== false) {
    const outputArtifact = options.artifactPath ?? artifactPath;
    mkdirSync(dirname(outputArtifact), { recursive: true });
    writeFileSync(outputArtifact, `${JSON.stringify(result, null, 2)}\n`);
  }

  return { result, markdown };
}

function renderMatrix(variables, mapping) {
  const lines = [
    "# AWS Environment Matrix",
    "",
    "This matrix is generated from the canonical environment contract and `infra/environment-mapping.json`.",
    "Run `pnpm infra:validate` to detect contract drift. Secret values are never rendered here or passed as plain Terraform variables.",
    "",
    "| Variable | Classification | Secret | Source | Supplied by | Terraform generates | ECS | Frontend | Notes |",
    "| --- | --- | --- | --- | --- | --- | --- | --- | --- |"
  ];

  for (const variable of variables) {
    const entry = mapping[variable.name];
    if (!entry) continue;
    lines.push([
      `| \`${variable.name}\``,
      variable.scope,
      variable.secret ? "yes" : "no",
      escapeCell(entry.source),
      escapeCell(entry.suppliedBy),
      entry.terraformGenerated ? "yes" : "no",
      escapeCell(entry.ecsDestination),
      escapeCell(entry.frontendDestination),
      `${escapeCell(entry.notes)} |`
    ].join(" | "));
  }

  lines.push(
    "",
    "## Boundary Decisions",
    "",
    "- `DATABASE_URL` and `REDIS_URL` are assembled and populated after their managed services exist. Terraform creates only empty secret containers, so credentials do not enter state or plans.",
    "- `AWS_CLOUDFRONT_DOMAIN` remains unset because the distribution in this foundation serves the web application, not private organization files.",
    "- Optional SMTP credentials are added only when the chosen provider requires them; the default staging plan does not create unused secret dependencies.",
    "- Frontend runtime config contains public metadata only and is uploaded separately for `es`, `en` and `pt-BR`."
  );
  return `${lines.join("\n")}\n`;
}

function escapeCell(value) {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const writeDocument = process.argv.includes("--write");
  const { result } = verifyInfrastructureEnvironmentContract({ writeDocument });
  if (result.status !== "PASS") {
    console.error("INFRASTRUCTURE ENVIRONMENT CONTRACT FAILED");
    result.errors.forEach((error) => console.error(`- ${error}`));
    process.exit(1);
  }
  console.log(`✓ Infrastructure environment contract covers ${result.mappedVariables} production runtime variables`);
}
