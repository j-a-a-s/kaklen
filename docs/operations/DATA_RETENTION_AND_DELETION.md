# Data Retention and Deletion

## Scope

This document defines the retention, anonymization and deletion procedures for personal and commercial data stored by the Kaklen platform. It covers the full lifecycle from collection to secure removal, including propagation to backups and handling of partial failures.

## Data Categories

### Leads and LeadEvent

| Field | Source | Contains PII | Notes |
| --- | --- | --- | --- |
| `Lead.*` | Contact form (kokegroup, kaklen-marketing) | Yes | Name, email, phone (E.164), company, IP hash, UA hash |
| `LeadEvent.*` | System-generated audit trail | Indirect | References `leadId`; `metadata` JSON may contain PII |

**Schema constraint:** `LeadEvent.leadId` has `onDelete: Restrict`. A `Lead` row cannot be deleted while related `LeadEvent` rows exist. Deletion procedures must remove or anonymize `LeadEvent` records first, then the `Lead`.

### Accounts and Sessions

| Entity | Contains PII | Notes |
| --- | --- | --- |
| `User` | Yes | Email, name, hashed password |
| `Session` | Yes | Linked to user; contains token hash |
| `PasswordResetToken` | Yes | Linked to user email |
| `EmailVerificationToken` | Yes | Linked to user email |

### Organizations and Commercial Data

| Entity | Contains PII | Notes |
| --- | --- | --- |
| `Organization` | Limited | Business name, slug |
| `Client` | Yes | Name, email, phone of the organization's clients |
| `Quotation`, `QuotationItem`, `QuotationPublicLink` | Limited | May reference client PII indirectly |
| `Event`, `EventItem`, `EventStaff`, `EventTimeline` | Limited | Staff names may be PII |
| `Payment`, `PaymentEvent`, `PaymentWebhookLog`, `PaymentReceipt` | Yes | Transaction data, payer references |
| `ProviderProfile`, `ProviderService` | Limited | Provider business data |

## Retention Periods

> **OWNER_DECISION:** The following retention periods must be defined by the product owner with legal counsel before production launch. Placeholder values are marked `[TBD]`.

| Category | Retention period | Responsible | Legal basis |
| --- | --- | --- | --- |
| Lead (active/qualified) | `[TBD — OWNER_DECISION]` | `[TBD — OWNER_DECISION]` | Consent at collection |
| Lead (closed/archived) | `[TBD — OWNER_DECISION]` | `[TBD — OWNER_DECISION]` | Legitimate interest / legal obligation |
| LeadEvent (audit trail) | `[TBD — OWNER_DECISION]` | `[TBD — OWNER_DECISION]` | Audit requirement |
| User account (inactive) | `[TBD — OWNER_DECISION]` | `[TBD — OWNER_DECISION]` | Contractual necessity |
| Session / tokens (expired) | 30 days after expiry (suggested) | Engineering | Security hygiene |
| Commercial data (organization) | `[TBD — OWNER_DECISION]` | `[TBD — OWNER_DECISION]` | Contractual / tax |
| Payment records | `[TBD — OWNER_DECISION]` | `[TBD — OWNER_DECISION]` | Tax and regulatory — consult local law |
| Backups containing PII | `[TBD — OWNER_DECISION]` | `[TBD — OWNER_DECISION]` | Must not exceed source retention + backup rotation |

> **OWNER_DECISION:** Response deadline for data subject requests (access, rectification, deletion) must be defined. Recommended: 10 business days.

> **OWNER_DECISION:** Legal exceptions that override deletion requests (e.g., tax retention, ongoing disputes) must be enumerated.

## Subject Rights Procedures

### Access Request

1. Verify requester identity (email match + secondary confirmation).
2. Export all records linked to the verified email across `Lead`, `User`, `Client`, and `Payment` tables.
3. Deliver in machine-readable format (JSON or CSV).
4. Log the request and fulfillment in the operations log with date and operator.

### Rectification Request

1. Verify requester identity.
2. Update the specific fields indicated by the subject.
3. Record the change in the operations log with before/after values (redacted if sensitive).
4. If the subject is a `Lead`, append a `LeadEvent` with `eventType: DATA_RECTIFIED`.

### Deletion Request

1. Verify requester identity.
2. Check for legal exceptions that block deletion (see OWNER_DECISION above).
3. If no exception applies, execute the deletion procedure for the relevant category (see below).
4. If an exception applies, inform the subject of the legal basis and the expected retention period.
5. Log the request, decision, and execution in the operations log.

## Deletion Procedures

### Lead Deletion

Due to `onDelete: Restrict` on `LeadEvent`, the following order is mandatory:

1. **Identify** all `LeadEvent` rows for the target `leadId`.
2. **Decide: delete or anonymize.**
   - If audit retention allows deletion: `DELETE FROM "LeadEvent" WHERE "leadId" = $1`.
   - If audit trail must be preserved: anonymize (see Anonymization below).
3. **Delete the Lead:** `DELETE FROM "Lead" WHERE "id" = $1`.
4. **Verify:** confirm zero rows remain for the `leadId` in both tables.
5. **Record evidence:** operator, timestamp, leadId, action taken, verification result.

### User Account Deletion

1. Delete or invalidate all `Session`, `PasswordResetToken`, and `EmailVerificationToken` rows.
2. Remove or reassign `OrganizationMembership` records.
3. If the user is the sole owner of an organization, require ownership transfer before proceeding.
4. Delete the `User` row.
5. Record evidence.

### Client Deletion (within Organization)

1. Verify no active quotations or events reference the client (cascade constraints apply).
2. Archive or delete dependent records.
3. Delete the `Client` row.
4. Record evidence.

## Anonymization

When an audit trail must survive deletion of PII:

1. Replace `firstName`, `lastName` with `"[REDACTED]"`.
2. Replace `email` with a non-reversible hash: `SHA-256(email + anonymization_salt)@redacted.local`.
3. Replace `phoneE164` with `"+0000000000"`.
4. Set `company`, `position`, `country` to `NULL`.
5. Clear `consentIpHash`, `userAgentHash`.
6. In `LeadEvent.metadata` JSON, replace any PII fields with `"[REDACTED]"`.
7. Set `Lead.status` to `ARCHIVED`.
8. Append a `LeadEvent` with `eventType: DATA_ANONYMIZED` and metadata recording operator and timestamp.

The anonymized record retains its `id` and `createdAt` for audit continuity but contains no reversible PII.

## Backup Propagation

> **OWNER_DECISION:** Backup rotation period must be defined. All backups older than this period must be destroyed as part of the retention lifecycle.

### Procedure

1. After a deletion or anonymization is executed in the primary database, record the affected IDs and timestamp.
2. When the next backup rotation cycle runs, verify that no backup created after the deletion contains the original PII.
3. Backups created before the deletion will be destroyed according to the rotation schedule.
4. Until all pre-deletion backups have rotated out, maintain a sealed log of pending propagation.
5. Once the last pre-deletion backup is destroyed, close the propagation record.

### Constraints

- Backups must not be selectively edited (point-in-time integrity).
- Deletion propagation is achieved through backup expiry, not backup mutation.
- The sealed propagation log is the evidence that the process completed.

## Authorization and Dual Control

| Action | Required authorization | Dual control |
| --- | --- | --- |
| Access request fulfillment | Operator with `data:export` permission | Review by a second operator before delivery |
| Rectification | Operator with `data:write` permission | Change log reviewed by second operator |
| Single-record deletion | Operator with `data:delete` permission | Second operator confirms the deletion target |
| Bulk deletion (>10 records) | Product owner explicit approval | Engineering lead confirms scope and executes |
| Anonymization | Operator with `data:delete` permission | Second operator verifies anonymization completeness |
| Backup destruction | Infrastructure owner | Product owner co-signs |

## Evidence of Execution

Every retention action must produce an evidence record containing:

| Field | Description |
| --- | --- |
| `operationId` | UUID for the operation |
| `operationType` | `ACCESS`, `RECTIFICATION`, `DELETION`, `ANONYMIZATION`, `BACKUP_ROTATION` |
| `operatorId` | ID of the person who executed the action |
| `reviewerId` | ID of the second operator (dual control) |
| `targetEntity` | Table name and record ID(s) |
| `requestedAt` | Timestamp of the subject's request |
| `executedAt` | Timestamp of execution |
| `verifiedAt` | Timestamp of post-execution verification |
| `result` | `COMPLETED`, `PARTIAL_FAILURE`, `BLOCKED_BY_EXCEPTION` |
| `notes` | Free text for exceptions or context |

Evidence records must be stored in an append-only log separate from the data being deleted.

## Partial Failure Handling

1. If a deletion fails mid-transaction (e.g., `LeadEvent` deleted but `Lead` deletion fails):
   - The transaction must roll back entirely (use database transactions).
   - Log the failure with error details.
   - Retry once after investigating the cause.
   - If the second attempt fails, escalate to the engineering lead.
2. If anonymization partially applies:
   - Treat the record as still containing PII until all fields are confirmed anonymized.
   - Re-run the anonymization procedure on the incomplete record.
3. If backup propagation stalls:
   - The sealed propagation log keeps the record open.
   - Escalate to the infrastructure owner if a backup exceeds its scheduled rotation date.
4. All partial failures must be recorded in the evidence log with `result: PARTIAL_FAILURE`.
