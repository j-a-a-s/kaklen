import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { QUALITY_PROFILES, resolveProfile } from "./quality-pipeline-core.mjs";

export const COVERAGE_THRESHOLDS = Object.freeze({ statements: 90, branches: 85, functions: 90, lines: 90 });
export const EXTERNAL_VALIDATION_KEYS = Object.freeze([
  "AWS_STAGING_VALIDATED",
  "REAL_WHATSAPP_VALIDATED",
  "PRODUCTION_PAYMENT_GATEWAY_VALIDATED"
]);

const SECURITY_TASKS = ["secret-scan", "sast", "sbom", "dependency-audit"];
const LOCALIZED_TASKS = ["build-es", "build-en", "build-pt-BR", "i18n-server"];

export function collectTechnicalScorecard({ root = process.cwd(), env = process.env } = {}) {
  const coverage = readJson(resolve(root, "apps/api/coverage/coverage-summary.json"));
  const forms = readJson(resolve(root, "artifacts/forms-audit.json"));
  const gate = readJson(resolve(root, "artifacts/quality-gate.json"), { profile: null, status: "missing", tasks: [] });
  const e2e = readJson(resolve(root, "artifacts/e2e-result.json"), { status: "missing", accessibilityIncluded: false });
  const i18n = readJson(resolve(root, "artifacts/i18n-server.json"), { status: "missing", locales: [] });
  const migrationCount = countMigrationDirectories(resolve(root, "prisma/migrations"));
  const expectedTasks = resolveProfile("quality:gate:ci").tasks.map((task) => task.key);
  const gateTasks = Array.isArray(gate.tasks) ? gate.tasks : [];
  const gateTasksByKey = new Map(gateTasks.map((task) => [task.key, task]));
  const coverageTotal = coverage.total ?? emptyCoverage();
  const coveragePass = Object.entries(COVERAGE_THRESHOLDS).every(
    ([metric, threshold]) => Number(coverageTotal[metric]?.pct ?? 0) >= threshold
  );
  const uniqueGateTasks = gateTasks.length > 0 && new Set(gateTasks.map((task) => task.key)).size === gateTasks.length;
  const canonicalTasksUnique = new Set(expectedTasks).size === expectedTasks.length;
  const taskPassed = (key) => gateTasksByKey.get(key)?.status === "passed";
  const taskReady = (key) => taskPassed(key) || (key === "scorecard" && gateTasksByKey.get(key)?.status === "running");
  const canonicalGateReady =
    Object.hasOwn(QUALITY_PROFILES, gate.profile) &&
    uniqueGateTasks &&
    canonicalTasksUnique &&
    expectedTasks.every(taskReady);
  const securityPassed = SECURITY_TASKS.every(taskPassed) && existsSync(resolve(root, "artifacts/sbom.cdx.json"));
  const i18nPassed =
    LOCALIZED_TASKS.every(taskPassed) &&
    i18n.status === "passed" &&
    ["es", "en", "pt-BR"].every((locale) => i18n.locales.includes(locale));
  const e2ePassed = taskPassed("e2e") && e2e.status === "passed";
  const accessibilityPassed = taskPassed("accessibility") && e2e.accessibilityIncluded === true;

  const localCriteria = [
    criterion("coverage", "Coverage thresholds", coveragePass, "apps/api/coverage/coverage-summary.json"),
    criterion("forms", "AST form contract", forms.status === "passed" && forms.controlCount > 0, "artifacts/forms-audit.json"),
    criterion("migrations", "Migration history", migrationCount > 0 && taskPassed("migration-verification"), `${migrationCount} migration directories`),
    criterion("pipeline-unique", "Unique quality tasks", canonicalTasksUnique && uniqueGateTasks, "scripts/quality-pipeline-core.mjs"),
    criterion("pipeline-complete", "Canonical CI controls", canonicalGateReady, `${expectedTasks.length} required tasks`),
    criterion("pdf-money", "PDF monetary parity", taskPassed("pdf-money-parity"), "pdf-money-parity"),
    criterion("i18n", "Localized builds and routing", i18nPassed, "es, en, pt-BR"),
    criterion("e2e", "End-to-end workflow", e2ePassed, "artifacts/e2e-result.json"),
    criterion("accessibility", "Accessibility suite", accessibilityPassed, "E2E accessibility evidence"),
    criterion("security", "Security controls and SBOM", securityPassed, "secret scan, SAST, SBOM, dependency audit")
  ];

  const productionCriteria = [
    criterion("database", "Database replay and demo dataset", taskPassed("migration-verification") && taskPassed("demo-verify"), "quality gate"),
    criterion("runtime", "Production API and container build", taskPassed("api-build-verification") && taskPassed("docker-api"), "quality gate"),
    criterion("localized-web", "Localized web delivery", i18nPassed, "artifacts/i18n-server.json"),
    criterion("critical-workflow", "Critical browser workflow", e2ePassed && accessibilityPassed, "artifacts/e2e-result.json")
  ];

  const externalCriteria = [
    criterion("aws-staging", "AWS staging validated", env.AWS_STAGING_VALIDATED === "true", "AWS_STAGING_VALIDATED"),
    criterion("whatsapp-real", "Real WhatsApp delivery validated", env.REAL_WHATSAPP_VALIDATED === "true", "REAL_WHATSAPP_VALIDATED"),
    criterion(
      "payment-production",
      "Production payment gateway validated",
      env.PRODUCTION_PAYMENT_GATEWAY_VALIDATED === "true",
      "PRODUCTION_PAYMENT_GATEWAY_VALIDATED"
    )
  ];

  const sections = {
    localQuality: section(localCriteria),
    productionReadiness: section(productionCriteria),
    externalValidation: section(externalCriteria)
  };
  const allCriteria = [...localCriteria, ...productionCriteria, ...externalCriteria];

  return {
    schemaVersion: 1,
    metrics: {
      coverage: Object.fromEntries(Object.keys(COVERAGE_THRESHOLDS).map((metric) => [metric, Number(coverageTotal[metric]?.pct ?? 0)])),
      forms: {
        formCount: Number(forms.formCount ?? 0),
        controlCount: Number(forms.controlCount ?? 0),
        controlsByType: forms.controlsByType ?? {}
      },
      migrations: migrationCount,
      pipeline: {
        profile: gate.profile,
        status: canonicalGateReady ? "validated" : "incomplete",
        taskCount: expectedTasks.filter((key) => gateTasksByKey.has(key)).length,
        expectedTaskCount: expectedTasks.length,
        unique: uniqueGateTasks
      }
    },
    sections,
    overall: section(allCriteria),
    externalValidationRequired: externalCriteria.filter((item) => !item.met).map((item) => item.id)
  };
}

export function renderTechnicalScorecard(scorecard) {
  const coverage = scorecard.metrics.coverage;
  const forms = scorecard.metrics.forms;
  const controls = Object.entries(forms.controlsByType)
    .map(([type, count]) => `${type}: ${count}`)
    .join(", ");
  const lines = [
    "# Technical Scorecard",
    "",
    "Este documento se genera con `pnpm scorecard:update`. No contiene fechas ni SHA para evitar ciclos de actualización.",
    "",
    "## Current Metrics",
    "",
    "| Metric | Current value |",
    "| --- | ---: |",
    `| Statements coverage | ${formatPercent(coverage.statements)} |`,
    `| Branches coverage | ${formatPercent(coverage.branches)} |`,
    `| Functions coverage | ${formatPercent(coverage.functions)} |`,
    `| Lines coverage | ${formatPercent(coverage.lines)} |`,
    `| Audited forms | ${forms.formCount} |`,
    `| Audited controls | ${forms.controlCount}${controls ? ` (${controls})` : ""} |`,
    `| Prisma migrations | ${scorecard.metrics.migrations} |`,
    `| Canonical pipeline tasks | ${scorecard.metrics.pipeline.expectedTaskCount} |`,
    "",
    ...renderSection("Local Quality", scorecard.sections.localQuality),
    ...renderSection("Production Readiness", scorecard.sections.productionReadiness),
    ...renderSection("External Validation", scorecard.sections.externalValidation),
    "## Overall",
    "",
    `Measured compliance: **${scorecard.overall.met} of ${scorecard.overall.total} criteria (${scorecard.overall.score.toFixed(2)}/10)**.`,
    "",
    "The global score cannot reach 10/10 while any external validation remains pending.",
    "",
    "## Real External Pending Work",
    "",
    ...(scorecard.externalValidationRequired.length > 0
      ? scorecard.externalValidationRequired.map((id) => `- ${externalPendingText(id)}`)
      : ["- No external validation is pending."]),
    ""
  ];
  return lines.join("\n");
}

export function assertScorecardCurrent(expected, actual) {
  if (expected !== actual) throw new Error("TECHNICAL_SCORECARD.md is stale. Run pnpm scorecard:update.");
}

function criterion(id, label, met, evidence) {
  return { id, label, met: met === true, evidence };
}

function section(criteria) {
  const met = criteria.filter((item) => item.met).length;
  return { met, total: criteria.length, score: criteria.length === 0 ? 0 : Number(((met / criteria.length) * 10).toFixed(2)), criteria };
}

function renderSection(title, value) {
  return [
    `## ${title}`,
    "",
    "| Criterion | Status | Evidence |",
    "| --- | --- | --- |",
    ...value.criteria.map((item) => `| ${item.label} | ${item.met ? "PASS" : "PENDING"} | \`${item.evidence}\` |`),
    "",
    `Result: **${value.met} of ${value.total} criteria**.`,
    ""
  ];
}

function readJson(path, fallback) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    if (fallback !== undefined) return fallback;
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Required scorecard evidence is unavailable at ${path}: ${detail}`);
  }
}

function countMigrationDirectories(path) {
  return readdirSync(path, { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
}

function emptyCoverage() {
  return Object.fromEntries(Object.keys(COVERAGE_THRESHOLDS).map((metric) => [metric, { pct: 0 }]));
}

function formatPercent(value) {
  return `${Number(value).toFixed(2)}%`;
}

function externalPendingText(id) {
  if (id === "aws-staging") return "Validate the deployed AWS staging environment and set `AWS_STAGING_VALIDATED=true` with evidence.";
  if (id === "whatsapp-real") return "Integrate and validate real WhatsApp delivery; local mode remains manual.";
  return "Integrate and validate a production payment gateway; local mode remains sandbox.";
}
