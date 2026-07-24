# Production Go-Live Checklist

## How to Use This Document

Each item has the following fields:

| Field | Description |
| --- | --- |
| Responsible | Role or person accountable |
| Status | `NOT_STARTED`, `IN_PROGRESS`, `BLOCKED`, `APPROVED` |
| Evidence | Link to artifact, screenshot, or log confirming completion |
| SHA | Commit hash at which the evidence was produced |
| Date | ISO 8601 date of approval |
| Approval Criteria | What must be true for the item to be marked `APPROVED` |

**Rule:** No item may be marked `APPROVED` without concrete evidence at the stated SHA. Placeholder approvals are forbidden.

---

## A. Alpha Controlada

The alpha phase runs with a controlled set of users, limited integrations, and no real payment processing. Its purpose is to validate the deployed stack end-to-end before opening to broader audiences.

### A.1 AWS Staging Validated

| Field | Value |
| --- | --- |
| Responsible | Infrastructure owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | `pnpm infra:plan:staging` passes; Terraform apply succeeds on staging; ECS tasks healthy; ALB returns 200 on `/api/health`; RDS and Redis reachable from ECS |

### A.2 Payments Disabled

| Field | Value |
| --- | --- |
| Responsible | Product owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | Payment gateway is not configured; `PAYMENT_GATEWAY_MODE=disabled` or equivalent; no real charges can be initiated; UI hides or disables payment actions |

### A.3 WhatsApp Manual Mode

| Field | Value |
| --- | --- |
| Responsible | Product owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | `WHATSAPP_MODE=manual` in production config; no automated WhatsApp messages are sent; `wa.me` links are generated for manual use; see [WHATSAPP_FLOW.md](../notifications/WHATSAPP_FLOW.md) |

### A.4 Transactional Email Operational

| Field | Value |
| --- | --- |
| Responsible | Engineering lead |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | `REAL_TRANSACTIONAL_EMAIL_VALIDATED` is `true` per [TRANSACTIONAL_EMAIL_RUNBOOK.md](../operations/TRANSACTIONAL_EMAIL_RUNBOOK.md); verification, reset, and invitation emails delivered and verified with controlled addresses |

### A.5 Database Backups Configured

| Field | Value |
| --- | --- |
| Responsible | Infrastructure owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | RDS automated backups enabled with defined retention; at least one manual snapshot created and verified restorable; backup schedule documented |

### A.6 Alerting Configured

| Field | Value |
| --- | --- |
| Responsible | Infrastructure owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | CloudWatch alarms for: ECS task failures, RDS CPU > 80%, ALB 5xx rate > 1%, Redis evictions; alarm notifications delivered to at least one verified channel (email or Slack) |

### A.7 Monitoring Operational

| Field | Value |
| --- | --- |
| Responsible | Engineering lead |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | Structured logs flowing to CloudWatch; `/api/health`, `/api/health/live`, `/api/health/ready` return correct status; dashboard or log query exists for request latency and error rate |

### A.8 Rollback Procedure Tested

| Field | Value |
| --- | --- |
| Responsible | Engineering lead |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | At least one successful rollback drill: deploy version N, then roll back to N-1; ECS service stable after rollback; documented in operations log |

### A.9 Data Retention Policy Defined

| Field | Value |
| --- | --- |
| Responsible | Product owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | All `OWNER_DECISION` placeholders in [DATA_RETENTION_AND_DELETION.md](../operations/DATA_RETENTION_AND_DELETION.md) have been resolved with concrete values and legal review |

### A.10 Support Channel Established

| Field | Value |
| --- | --- |
| Responsible | Product owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | At least one channel for alpha users to report issues (email, form, or chat); incident response procedure is known to all team members; see [INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md) |

---

## B. Produccion Completa

Production phase adds real payment processing, automated WhatsApp, high availability, and operational maturity. All Alpha items must be `APPROVED` before any Production item can be marked `APPROVED`.

### B.1 Payment Gateway Productivo

| Field | Value |
| --- | --- |
| Responsible | Engineering lead |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | Production payment gateway credentials configured; at least one real test transaction completed and refunded; webhook endpoint receives and processes payment events; `PRODUCTION_PAYMENT_GATEWAY_VALIDATED` is `true` |

### B.2 WhatsApp Provider Integrado

| Field | Value |
| --- | --- |
| Responsible | Engineering lead |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | `WHATSAPP_MODE=provider` with a real WhatsApp Business API adapter; at least one automated message delivered to a controlled number; callbacks (`SENT`, `FAILED`, `OPENED`) verified; `REAL_WHATSAPP_VALIDATED` is `true` |

### B.3 Resiliencia Multi-AZ

| Field | Value |
| --- | --- |
| Responsible | Infrastructure owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | RDS Multi-AZ enabled; ECS tasks distributed across at least 2 AZs; ALB routes to multiple AZs; failover tested by simulating AZ outage |

### B.4 Redis con Failover

| Field | Value |
| --- | --- |
| Responsible | Infrastructure owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | ElastiCache Redis with automatic failover enabled (Multi-AZ replication group); failover tested and recovery time documented |

### B.5 ECS Minimo Dos Tareas

| Field | Value |
| --- | --- |
| Responsible | Infrastructure owner |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | ECS service `desiredCount >= 2`; rolling deployment strategy configured; zero-downtime deployment verified |

### B.6 On-Call y RPO/RTO

| Field | Value |
| --- | --- |
| Responsible | Product owner + Engineering lead |
| Status | `NOT_STARTED` |
| Evidence | — |
| SHA | — |
| Date | — |
| Approval Criteria | On-call rotation defined with at least 2 people; RPO and RTO targets documented; backup restore drill completed within RPO/RTO targets; see severity definitions in [INCIDENT_RESPONSE.md](../operations/INCIDENT_RESPONSE.md) |
