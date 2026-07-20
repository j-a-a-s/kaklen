import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { resolveProfile } from "./quality-pipeline-core.mjs";
import {
  assertScorecardCurrent,
  assertReadmeScorecardCurrent,
  collectTechnicalScorecard,
  renderReadmeScorecardSummary,
  renderTechnicalScorecard
} from "./technical-scorecard-core.mjs";

test("stale technical scorecard is rejected", () => {
  assert.throws(() => assertScorecardCurrent("current\n", "stale\n"), /stale/);
  assert.doesNotThrow(() => assertScorecardCurrent("current\n", "current\n"));
});

test("missing external validations prevent a global 10 out of 10", () => {
  const root = createEvidenceFixture();
  const scorecard = collectTechnicalScorecard({ root, env: {} });
  assert.ok(scorecard.overall.score < 10);
  assert.equal(scorecard.sections.externalValidation.met, 0);
  assert.deepEqual(scorecard.externalValidationRequired, ["aws-staging", "whatsapp-real", "payment-production"]);
  assert.match(renderTechnicalScorecard(scorecard), /cannot reach 10\/10/);
});

test("all external validations can complete the generated scorecard", () => {
  const root = createEvidenceFixture();
  const scorecard = collectTechnicalScorecard({
    root,
    env: {
      AWS_STAGING_VALIDATED: "true",
      REAL_WHATSAPP_VALIDATED: "true",
      PRODUCTION_PAYMENT_GATEWAY_VALIDATED: "true"
    }
  });
  assert.equal(scorecard.overall.score, 10);
  assert.deepEqual(scorecard.externalValidationRequired, []);
});

test("an incomplete quality gate cannot claim canonical controls", () => {
  const root = createEvidenceFixture({ omittedTask: "pdf-money-parity" });
  const scorecard = collectTechnicalScorecard({ root, env: {} });
  const pipeline = scorecard.sections.localQuality.criteria.find((item) => item.id === "pipeline-complete");
  const pdf = scorecard.sections.localQuality.criteria.find((item) => item.id === "pdf-money");

  assert.equal(scorecard.metrics.pipeline.status, "incomplete");
  assert.equal(pipeline?.met, false);
  assert.equal(pdf?.met, false);
});

test("the scorecard task may be running while it validates the completed gate", () => {
  const root = createEvidenceFixture({ scorecardStatus: "running" });
  const scorecard = collectTechnicalScorecard({ root, env: {} });

  assert.equal(scorecard.metrics.pipeline.status, "validated");
  assert.equal(scorecard.metrics.pipeline.taskCount, scorecard.metrics.pipeline.expectedTaskCount);
});

test("a stale scorecard self-check does not change the generated scorecard", () => {
  const runningRoot = createEvidenceFixture({ scorecardStatus: "running" });
  const failedRoot = createEvidenceFixture({ scorecardStatus: "failed" });

  const runningDocument = renderTechnicalScorecard(collectTechnicalScorecard({ root: runningRoot, env: {} }));
  const failedDocument = renderTechnicalScorecard(collectTechnicalScorecard({ root: failedRoot, env: {} }));

  assert.equal(failedDocument, runningDocument);
});

test("sub-tenth coverage differences produce the same versioned scorecard", () => {
  const localScorecard = collectTechnicalScorecard({ root: createEvidenceFixture(), env: {} });
  const ciScorecard = collectTechnicalScorecard({ root: createEvidenceFixture(), env: {} });
  localScorecard.metrics.coverage.branches = 85.75;
  ciScorecard.metrics.coverage.branches = 85.81;

  assert.equal(renderTechnicalScorecard(localScorecard), renderTechnicalScorecard(ciScorecard));
});

test("README exposes the quality badge, scorecard link, and generated summary", () => {
  const readme = readFileSync("README.md", "utf8");
  assert.match(
    readme,
    /\[!\[Kaklen Quality Gate\]\(https:\/\/github\.com\/j-a-a-s\/kaklen\/actions\/workflows\/ci\.yml\/badge\.svg\?branch=main\)\]\(https:\/\/github\.com\/j-a-a-s\/kaklen\/actions\/workflows\/ci\.yml\)/
  );
  assert.match(readme, /\[Technical Scorecard\]\(docs\/release\/TECHNICAL_SCORECARD\.md\)/);
  assert.match(readme, /<!-- scorecard-summary:start -->[\s\S]*<!-- scorecard-summary:end -->/);
});

test("README scorecard summary is deterministic and rejects drift", () => {
  const scorecard = collectTechnicalScorecard({ root: createEvidenceFixture(), env: {} });
  const summary = renderReadmeScorecardSummary(scorecard);
  assert.match(summary, /\| Statements \| 96\.0% \|/);
  assert.match(summary, /\| Local Quality \| 10\/10 \|/);
  assert.doesNotThrow(() => assertReadmeScorecardCurrent(scorecard, `before\n${summary}\nafter\n`));
  assert.throws(
    () => assertReadmeScorecardCurrent(scorecard, `before\n${summary.replace("96.0%", "95.0%")}\nafter\n`),
    /stale/
  );
});

function createEvidenceFixture({ omittedTask = null, scorecardStatus = "passed" } = {}) {
  const root = mkdtempSync(join(tmpdir(), "kaklen-scorecard-"));
  const taskKeys = resolveProfile("quality:gate:ci").tasks.map((task) => task.key).filter((key) => key !== omittedTask);
  writeJson(root, "apps/api/coverage/coverage-summary.json", {
    total: {
      statements: { pct: 96 },
      branches: { pct: 86 },
      functions: { pct: 94 },
      lines: { pct: 97 }
    }
  });
  writeJson(root, "artifacts/forms-audit.json", {
    status: "passed",
    formCount: 25,
    controlCount: 137,
    controlsByType: { input: 91, select: 36, textarea: 10 }
  });
  writeJson(root, "artifacts/quality-gate.json", {
    profile: "quality:gate:ci",
    status: scorecardStatus === "running" ? "running" : scorecardStatus === "failed" ? "failed" : "passed",
    tasks: taskKeys.map((key) => ({ key, status: key === "scorecard" ? scorecardStatus : "passed" }))
  });
  writeJson(root, "artifacts/e2e-result.json", { status: "passed", accessibilityIncluded: true });
  writeJson(root, "artifacts/i18n-server.json", { status: "passed", locales: ["es", "en", "pt-BR"] });
  writeFile(root, "artifacts/sbom.cdx.json", "{}\n");
  writeFile(root, "prisma/migrations/20260101000000_initial/migration.sql", "SELECT 1;\n");
  return root;
}

function writeJson(root, path, value) {
  writeFile(root, path, `${JSON.stringify(value)}\n`);
}

function writeFile(root, path, value) {
  const absolute = join(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}
