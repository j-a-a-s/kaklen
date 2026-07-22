#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rawPath = resolve(".artifacts/infra/trivy.json");
const artifactPath = resolve("artifacts/infrastructure-trivy.json");

export function evaluateTrivyReport(report) {
  const failures = [];
  const acceptedDesignFindings = [];

  for (const result of report.Results ?? []) {
    for (const finding of result.Misconfigurations ?? []) {
      const normalized = {
        id: finding.AVDID ?? finding.ID ?? "unknown",
        severity: finding.Severity ?? "UNKNOWN",
        target: result.Target ?? "unknown",
        title: finding.Title ?? finding.Message ?? "Infrastructure finding",
        message: finding.Message ?? ""
      };
      if (isPublicAlbDesignFinding(normalized)) {
        acceptedDesignFindings.push({
          ...normalized,
          rationale: "The target architecture requires an internet-facing API ALB. TLS, WAF, rate control and ALB-only ECS ingress mitigate this intentional exposure."
        });
      } else if (isPasswordDurationFalsePositive(normalized)) {
        acceptedDesignFindings.push({
          ...normalized,
          rationale: "PASSWORD_RESET_EXPIRES_MINUTES is a numeric lifetime, not a password. Actual Kaklen secrets use ECS Secrets Manager references."
        });
      } else if (isStaticWebEncryptionFinding(normalized)) {
        acceptedDesignFindings.push({
          ...normalized,
          rationale: "Private business objects use a rotated customer-managed KMS key. Public web bundles use SSE-S3 so CloudFront OAC can read them without granting a customer key."
        });
      } else {
        failures.push(normalized);
      }
    }
  }

  return {
    status: failures.length === 0 ? "PASS" : "FAIL",
    scanner: "Trivy config",
    acceptedDesignFindings,
    failures
  };
}

function isPasswordDurationFalsePositive(finding) {
  return (
    ["AWS-0036", "AVD-AWS-0036"].includes(finding.id) &&
    finding.severity === "CRITICAL" &&
    finding.target.endsWith("modules/ecs/main.tf") &&
    finding.message.includes("PASSWORD_RESET_EXPIRES_MINUTES")
  );
}

function isStaticWebEncryptionFinding(finding) {
  return (
    ["AWS-0132", "AVD-AWS-0132"].includes(finding.id) &&
    finding.severity === "HIGH" &&
    finding.target.endsWith("modules/storage/main.tf")
  );
}

function isPublicAlbDesignFinding(finding) {
  return (
    ["AWS-0053", "AVD-AWS-0053"].includes(finding.id) &&
    finding.severity === "HIGH" &&
    finding.target.endsWith("modules/load-balancer/main.tf")
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = JSON.parse(readFileSync(rawPath, "utf8"));
  const result = evaluateTrivyReport(report);
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(result, null, 2)}\n`);

  for (const finding of result.acceptedDesignFindings) {
    console.log(`ACCEPTED DESIGN FINDING ${finding.id}: ${finding.title}`);
    console.log(`- ${finding.rationale}`);
  }
  if (result.status !== "PASS") {
    console.error("TRIVY INFRASTRUCTURE SCAN FAILED");
    result.failures.forEach((finding) => console.error(`- ${finding.id} ${finding.severity}: ${finding.target} ${finding.title}`));
    process.exit(1);
  }
  console.log(`✓ Trivy configuration scan passed with ${result.acceptedDesignFindings.length} documented design finding(s)`);
}
