# Operations Runbook

## Local Health

```bash
pnpm run doctor
pnpm run setup
pnpm dev:full:i18n
curl http://localhost:3000/api/health
curl http://localhost:3000/api/health/ready
```

## Common Failures

| Symptom | Check | Action |
| --- | --- | --- |
| API cannot connect to DB | `pnpm run doctor` | Align `DATABASE_URL` with local PostgreSQL container |
| Frontend localized route blank | `pnpm verify:i18n-server` | Check base href, MIME and localized bundle root |
| Login says server unavailable | `/api/health/ready` | Start API with `pnpm dev:full:i18n` |
| Swagger unavailable | `/docs` | Confirm API process is running on port 3000 |
| E2E leaves process alive | `pnpm e2e` | Playwright uses graceful shutdown and Node orchestrator |

## Pre-Tag Commands

```bash
pnpm release:check
pnpm release:check:strict
```

`release:check` is the alpha readiness gate. `release:check:strict` is the 10/10 gate and is expected to block until coverage and AWS staging are complete.

## Observability Expectations

- API logs are structured JSON for requests.
- Each request includes `requestId`.
- Health endpoints expose version, commit, build time, environment and DB readiness.
- Staging must add CloudWatch alarms for API down, ready failing, 5xx, CPU, memory and RDS storage.

## Escalation

1. Confirm health status.
2. Check recent deployment SHA.
3. Check logs by `requestId`.
4. Roll back if the issue started after a deployment.
5. Preserve logs and timestamps for incident review.
