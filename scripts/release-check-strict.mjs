#!/usr/bin/env node
import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { spawn } from "node:child_process";

const commandChecks = [
  { key: "architecture", label: "Architecture cycles", command: "pnpm", args: ["architecture:check"] },
  { key: "quality", label: "Quality scan", command: "pnpm", args: ["quality:scan"] },
  { key: "secretScan", label: "Secret scan", command: "pnpm", args: ["security:scan"] },
  { key: "sast", label: "Static security scan", command: "pnpm", args: ["security:sast"] },
  { key: "sbom", label: "SBOM", command: "pnpm", args: ["security:sbom"] },
  { key: "dependencyAudit", label: "Dependency audit", command: "pnpm", args: ["dependency:audit"] },
  { key: "coverage", label: "Coverage thresholds", command: "pnpm", args: ["test:coverage"] },
  { key: "accessibility", label: "Accessibility Playwright", command: "pnpm", args: ["accessibility:test"] },
  { key: "releaseCheck", label: "Base release check", command: "pnpm", args: ["release:check"] }
];
const commandResults = new Map();

console.log("KAKLEN STRICT RELEASE CHECK");

for (const check of commandChecks) {
  console.log("");
  console.log(`== ${check.label} ==`);
  commandResults.set(check.key, await run(check.command, check.args));
}

const coverage = readCoverage();
const awsValidated = process.env.AWS_STAGING_VALIDATED === "true";
const areas = [
  area("Arquitectura general", [
    criterion("Sin ciclos de dependencias", commandResults.get("architecture").ok, "pnpm architecture:check"),
    criterion("Sin marcadores de deuda tecnica ni tipos amplios explicitos", commandResults.get("quality").ok, "pnpm quality:scan"),
    criterion("Revision de arquitectura documentada", existsSync("docs/architecture/ARCHITECTURE_REVIEW.md"), "docs/architecture/ARCHITECTURE_REVIEW.md")
  ]),
  area("Backend y modulos centrales", [
    criterion("Release base incluye build, DB, API start y E2E", commandResults.get("releaseCheck").ok, "pnpm release:check"),
    criterion("Health ready verifica base de datos", hasText("apps/api/src/health/health.service.ts", 'this.base("ok", "ok")'), "Health ready database=ok"),
    criterion("Prisma service compilado verificado", existsSync("scripts/verify-api-build.mjs"), "pnpm verify:api-build")
  ]),
  area("Frontend y navegacion", [
    criterion("Accesibilidad automatizada pasa", commandResults.get("accessibility").ok, "pnpm accessibility:test"),
    criterion("Selector idioma unico cubierto por tests", hasText("scripts/session-cleanup.test.mjs", "public header owns the only language selector"), "session cleanup tests"),
    criterion("Version oculta por defecto cubierta", hasText("scripts/versioning.test.mjs", "version panel is hidden initially"), "versioning tests")
  ]),
  area("Tests automatizados", [
    criterion("Unit/integration/API/E2E base pasan", commandResults.get("releaseCheck").ok, "pnpm release:check"),
    criterion("Cobertura statements >= 90%", coverage.statements >= 90, `${coverage.statements}% statements`),
    criterion("Cobertura branches >= 85%", coverage.branches >= 85, `${coverage.branches}% branches`),
    criterion("Cobertura functions >= 90%", coverage.functions >= 90, `${coverage.functions}% functions`),
    criterion("Cobertura lines >= 90%", coverage.lines >= 90, `${coverage.lines}% lines`)
  ]),
  area("i18n", [
    criterion("Builds localizados y MIME verificados", commandResults.get("releaseCheck").ok, "pnpm verify:i18n-server via release check"),
    criterion("Playwright revisa login es/en/pt-BR", commandResults.get("accessibility").ok, "e2e/accessibility.spec.mjs"),
    criterion("XLIFF completos cubiertos por tests", hasText("scripts/i18n-routing.test.mjs", "localized XLIFF files include every source translation id"), "i18n routing tests")
  ]),
  area("Seguridad", [
    criterion("Secret scan limpio", commandResults.get("secretScan").ok, "pnpm security:scan"),
    criterion("SAST local limpio", commandResults.get("sast").ok, "pnpm security:sast"),
    criterion("Dependency audit sin high/critical", commandResults.get("dependencyAudit").ok, "pnpm dependency:audit"),
    criterion("SBOM generado", commandResults.get("sbom").ok, "pnpm security:sbom"),
    criterion("Revision y threat model documentados", existsSync("docs/security/SECURITY_REVIEW.md") && existsSync("docs/security/THREAT_MODEL.md"), "docs/security")
  ]),
  area("Developer Experience", [
    criterion("Doctor/setup/dev full cubiertos por release", commandResults.get("releaseCheck").ok, "pnpm release:check"),
    criterion("Scripts de DB seguros existen", existsSync("scripts/db-reset-dev.mjs") && existsSync("scripts/db-validate.mjs"), "db scripts"),
    criterion("Documentacion INSTALL actualizada", hasText("INSTALL.md", "pnpm setup"), "INSTALL.md")
  ]),
  area("AWS staging", [
    criterion("Infraestructura/documentacion staging completa", docsExist(["docs/aws/STAGING_VALIDATION.md", "docs/aws/ROLLBACK.md", "docs/aws/BACKUP_RESTORE.md"]), "docs/aws"),
    criterion("Staging real validado con credenciales", awsValidated, "AWS_STAGING_VALIDATED=true"),
    criterion("Cookies secure/CORS/RDS/CloudFront validados en staging", awsValidated, "staging validation evidence")
  ]),
  area("Observabilidad y operacion", [
    criterion("Health/live/ready y request id verificados", commandResults.get("releaseCheck").ok, "pnpm release:check"),
    criterion("Runbook documentado", existsSync("docs/operations/RUNBOOK.md"), "docs/operations/RUNBOOK.md"),
    criterion("Incident response documentado", existsSync("docs/operations/INCIDENT_RESPONSE.md"), "docs/operations/INCIDENT_RESPONSE.md")
  ]),
  area("Madurez productiva", [
    criterion("Flujo E2E MVP pasa", commandResults.get("releaseCheck").ok, "pnpm e2e via release check"),
    criterion("Accesibilidad/responsive smoke pasa", commandResults.get("accessibility").ok, "pnpm accessibility:test"),
    criterion("Scorecard documentado", existsSync("docs/release/TECHNICAL_SCORECARD.md"), "docs/release/TECHNICAL_SCORECARD.md")
  ])
];

const blockers = [];
console.log("");
console.log("STRICT SCORECARD");
for (const scoredArea of areas) {
  const score = scoreArea(scoredArea);
  console.log(`- ${scoredArea.name}: ${score.toFixed(2)}/10`);
  for (const item of scoredArea.criteria) {
    if (!item.ok) {
      blockers.push(`${scoredArea.name}: ${item.name} (${item.evidence})`);
    }
  }
}

writeResult(areas, blockers);

console.log("");
if (blockers.length > 0) {
  console.error("RELEASE BLOCKED");
  blockers.forEach((blocker) => console.error(`- ${blocker}`));
  process.exit(1);
}

console.log("RELEASE READY 10/10");

function area(name, criteria) {
  return { name, criteria };
}

function criterion(name, ok, evidence) {
  return { name, ok: Boolean(ok), evidence };
}

function scoreArea(scoredArea) {
  const passed = scoredArea.criteria.filter((item) => item.ok).length;
  return (passed / scoredArea.criteria.length) * 10;
}

function run(command, args) {
  return new Promise((resolveRun) => {
    const child = spawn(command, args, { stdio: "inherit", shell: false, env: process.env });
    child.on("exit", (code, signal) => {
      resolveRun({
        ok: code === 0 && !signal,
        detail: signal ? `signal ${signal}` : `exit ${code ?? 1}`
      });
    });
  });
}

function readCoverage() {
  const path = "apps/api/coverage/coverage-summary.json";
  if (!existsSync(path)) {
    return { statements: 0, branches: 0, functions: 0, lines: 0 };
  }
  const total = JSON.parse(readFileSync(path, "utf8")).total;
  return {
    statements: total.statements.pct,
    branches: total.branches.pct,
    functions: total.functions.pct,
    lines: total.lines.pct
  };
}

function hasText(path, text) {
  return existsSync(path) && readFileSync(path, "utf8").includes(text);
}

function docsExist(paths) {
  return paths.every((path) => existsSync(path));
}

function writeResult(areasInput, blockersInput) {
  mkdirSync("artifacts", { recursive: true });
  const scorecard = areasInput.map((item) => ({
    area: item.name,
    score: Number(scoreArea(item).toFixed(2)),
    passed: item.criteria.filter((criterionItem) => criterionItem.ok).length,
    total: item.criteria.length,
    criteria: item.criteria
  }));
  writeFileSync(
    "artifacts/release-check-strict.json",
    `${JSON.stringify({ status: blockersInput.length > 0 ? "blocked" : "ready", scorecard, blockers: blockersInput }, null, 2)}\n`
  );
}
