# Technical Scorecard

Este documento se genera con `pnpm scorecard:update`. No contiene fechas ni SHA para evitar ciclos de actualización.

## Current Metrics

| Metric | Current value |
| --- | ---: |
| Statements coverage | 96.93% |
| Branches coverage | 85.32% |
| Functions coverage | 93.75% |
| Lines coverage | 97.22% |
| Audited forms | 25 |
| Audited controls | 137 (input: 91, select: 36, textarea: 10) |
| Prisma migrations | 18 |
| Canonical pipeline tasks | 28 |

## Local Quality

| Criterion | Status | Evidence |
| --- | --- | --- |
| Coverage thresholds | PASS | `apps/api/coverage/coverage-summary.json` |
| AST form contract | PASS | `artifacts/forms-audit.json` |
| Migration history | PASS | `18 migration directories` |
| Unique quality tasks | PASS | `scripts/quality-pipeline-core.mjs` |
| Canonical CI controls | PASS | `28 required tasks` |
| PDF monetary parity | PASS | `pdf-money-parity` |
| Localized builds and routing | PASS | `es, en, pt-BR` |
| End-to-end workflow | PASS | `artifacts/e2e-result.json` |
| Accessibility suite | PASS | `E2E accessibility evidence` |
| Security controls and SBOM | PASS | `secret scan, SAST, SBOM, dependency audit` |

Result: **10 of 10 criteria**.

## Production Readiness

| Criterion | Status | Evidence |
| --- | --- | --- |
| Database replay and demo dataset | PASS | `quality gate` |
| Production API and container build | PASS | `quality gate` |
| Localized web delivery | PASS | `artifacts/i18n-server.json` |
| Critical browser workflow | PASS | `artifacts/e2e-result.json` |

Result: **4 of 4 criteria**.

## External Validation

| Criterion | Status | Evidence |
| --- | --- | --- |
| AWS staging validated | PENDING | `AWS_STAGING_VALIDATED` |
| Real WhatsApp delivery validated | PENDING | `REAL_WHATSAPP_VALIDATED` |
| Production payment gateway validated | PENDING | `PRODUCTION_PAYMENT_GATEWAY_VALIDATED` |

Result: **0 of 3 criteria**.

## Overall

Measured compliance: **14 of 17 criteria (8.24/10)**.

The global score cannot reach 10/10 while any external validation remains pending.

## Real External Pending Work

- Validate the deployed AWS staging environment and set `AWS_STAGING_VALIDATED=true` with evidence.
- Integrate and validate real WhatsApp delivery; local mode remains manual.
- Integrate and validate a production payment gateway; local mode remains sandbox.
