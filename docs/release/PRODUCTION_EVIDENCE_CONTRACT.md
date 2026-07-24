# Production Evidence Contract

## Purpose

This document defines the evidence contract that must be satisfied before any production release of Kaklen. It mirrors the structure expected by automated verification tooling and ensures that every criterion is backed by real, timestamped evidence tied to a specific commit.

## Contract Schema

```json
{
  "schemaVersion": "1.0.0",
  "commitSha": "<40-char hex SHA of the release commit>",
  "awsStaging": { ... },
  "transactionalEmail": { ... },
  "whatsapp": { ... },
  "paymentGateway": { ... }
}
```

### Top-Level Fields

| Field | Type | Description |
| --- | --- | --- |
| `schemaVersion` | `string` | Semantic version of this contract schema. Current: `"1.0.0"` |
| `commitSha` | `string` | The exact 40-character commit SHA that the evidence applies to. All evidence must be produced at this SHA |

### Criterion Object Shape

Every criterion follows this structure:

```json
{
  "validated": false,
  "validatedAt": null,
  "evidenceUrl": null,
  "notes": ""
}
```

| Field | Type | Description |
| --- | --- | --- |
| `validated` | `boolean` | `true` only when all checks for this criterion have passed |
| `validatedAt` | `string \| null` | ISO 8601 timestamp of validation. `null` if not yet validated |
| `evidenceUrl` | `string \| null` | Relative path or URL to the artifact proving the validation. `null` if not yet validated |
| `notes` | `string` | Free text for context, blockers, or partial progress |

### Criteria

#### awsStaging

AWS staging environment is deployed, healthy, and accessible.

```json
{
  "awsStaging": {
    "validated": false,
    "validatedAt": null,
    "evidenceUrl": null,
    "notes": "Terraform plan passes locally; deploy and health check pending"
  }
}
```

**Validation requirements:**

- `pnpm infra:plan:staging` passes at the stated `commitSha`.
- Terraform apply succeeds on the staging environment.
- ECS tasks are running and healthy.
- ALB returns HTTP 200 on `/api/health` and `/api/health/ready`.
- RDS and Redis are reachable from ECS tasks.
- Evidence: `artifacts/sprint-4a-infrastructure-validation.json` or equivalent, plus health check screenshots.

#### transactionalEmail

Real transactional email is configured, authenticated, and delivering.

```json
{
  "transactionalEmail": {
    "validated": false,
    "validatedAt": null,
    "evidenceUrl": null,
    "notes": "Provider not yet selected"
  }
}
```

**Validation requirements:**

- All steps in [TRANSACTIONAL_EMAIL_RUNBOOK.md](../operations/TRANSACTIONAL_EMAIL_RUNBOOK.md) are complete.
- SPF, DKIM, and DMARC pass for the sender domain.
- Verification, password reset, and invitation emails delivered to controlled addresses.
- Bounce webhook configured and tested.
- Evidence: raw email headers, delivery receipts, provider dashboard screenshots.

#### whatsapp

WhatsApp provider integration is operational (or explicitly deferred to manual mode for alpha).

```json
{
  "whatsapp": {
    "validated": false,
    "validatedAt": null,
    "evidenceUrl": null,
    "notes": "Manual mode active; provider integration not started"
  }
}
```

**Validation requirements for full production:**

- `WHATSAPP_MODE=provider` with a real WhatsApp Business API adapter.
- At least one automated message delivered to a controlled number.
- Provider callbacks (`SENT`, `FAILED`, `OPENED`) verified.
- Evidence: delivery log, callback payloads, provider dashboard confirmation.

**Alpha exception:** For alpha, `WHATSAPP_MODE=manual` is acceptable. The criterion remains `validated: false` but does not block alpha launch. It blocks full production.

#### paymentGateway

Production payment processing is configured and verified.

```json
{
  "paymentGateway": {
    "validated": false,
    "validatedAt": null,
    "evidenceUrl": null,
    "notes": "Payments disabled for alpha"
  }
}
```

**Validation requirements:**

- Production payment gateway credentials configured in Secrets Manager.
- At least one real test transaction completed and refunded.
- Webhook endpoint receives and correctly processes payment events.
- Evidence: transaction receipt, webhook delivery log, refund confirmation.

**Alpha exception:** For alpha, payments are disabled. The criterion remains `validated: false` and does not block alpha launch. It blocks full production.

## Evidence Integrity Rules

1. **Same SHA:** All evidence must be produced at the `commitSha` specified in the contract. Evidence from a different commit is invalid.
2. **No forward-dating:** `validatedAt` must be the actual timestamp of validation, not a planned or estimated date.
3. **No placeholder approvals:** Setting `validated: true` without a corresponding `evidenceUrl` is a contract violation.
4. **Append-only updates:** Once a criterion is validated, it should not be reverted unless the evidence is invalidated (e.g., by a code change that breaks the criterion).
5. **Machine-verifiable:** The gap report (`artifacts/production-readiness-gap-report.json`) must be consistent with this contract at all times.

## Example: Fully Validated Contract

```json
{
  "schemaVersion": "1.0.0",
  "commitSha": "abc123def456...",
  "awsStaging": {
    "validated": true,
    "validatedAt": "2026-08-15T14:30:00Z",
    "evidenceUrl": "artifacts/aws-staging-validation.json",
    "notes": "All health checks pass; ECS 2 tasks running"
  },
  "transactionalEmail": {
    "validated": true,
    "validatedAt": "2026-08-16T10:00:00Z",
    "evidenceUrl": "artifacts/email-validation-evidence.json",
    "notes": "Resend configured; SPF/DKIM/DMARC pass; all templates verified"
  },
  "whatsapp": {
    "validated": true,
    "validatedAt": "2026-08-20T09:00:00Z",
    "evidenceUrl": "artifacts/whatsapp-validation-evidence.json",
    "notes": "Meta WABA integration; callbacks verified"
  },
  "paymentGateway": {
    "validated": true,
    "validatedAt": "2026-08-22T16:00:00Z",
    "evidenceUrl": "artifacts/payment-gateway-validation.json",
    "notes": "Stripe production; test charge and refund completed"
  }
}
```

## Related Documents

- [PRODUCTION_GO_LIVE_CHECKLIST.md](PRODUCTION_GO_LIVE_CHECKLIST.md) — operational checklist for alpha and production phases.
- [TRANSACTIONAL_EMAIL_RUNBOOK.md](../operations/TRANSACTIONAL_EMAIL_RUNBOOK.md) — detailed email setup procedure.
- [DATA_RETENTION_AND_DELETION.md](../operations/DATA_RETENTION_AND_DELETION.md) — data lifecycle controls.
- [TECHNICAL_SCORECARD.md](TECHNICAL_SCORECARD.md) — current local and external validation metrics.
