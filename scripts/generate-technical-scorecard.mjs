#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertReadmeScorecardCurrent,
  assertScorecardCurrent,
  collectTechnicalScorecard,
  renderReadmeScorecardSummary,
  renderTechnicalScorecard,
  replaceReadmeScorecardSummary
} from "./technical-scorecard-core.mjs";

const mode = process.argv[2] ?? "--generate";
const documentPath = resolve("docs/release/TECHNICAL_SCORECARD.md");
const artifactPath = resolve("artifacts/technical-scorecard.json");
const readmePath = resolve("README.md");

try {
  const scorecard = collectTechnicalScorecard();
  const document = renderTechnicalScorecard(scorecard);
  mkdirSync(dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(scorecard, null, 2)}\n`);

  if (mode === "--verify") {
    assertScorecardCurrent(document, readFileSync(documentPath, "utf8"));
    assertReadmeScorecardCurrent(scorecard, readFileSync(readmePath, "utf8"));
    console.log("SCORECARD CURRENT");
  } else if (mode === "--generate" || mode === "--update") {
    mkdirSync(dirname(documentPath), { recursive: true });
    writeFileSync(documentPath, document);
    const readme = readFileSync(readmePath, "utf8");
    writeFileSync(readmePath, replaceReadmeScorecardSummary(readme, renderReadmeScorecardSummary(scorecard)));
    console.log(`✓ Scorecard actualizado: ${documentPath}`);
  } else {
    throw new Error(`Unknown scorecard mode: ${mode}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "No fue posible generar el scorecard.");
  process.exitCode = 1;
}
