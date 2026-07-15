# Incident Response

## Severity

| Severity | Definition | Response |
| --- | --- | --- |
| SEV1 | API unavailable, data loss risk, auth broken | Immediate mitigation and rollback decision |
| SEV2 | Core workflow degraded for many users | Mitigate, monitor and prepare rollback |
| SEV3 | Isolated module failure or cosmetic issue | Fix in normal priority |

## First 15 Minutes

1. Identify impacted environment and version.
2. Capture `/api/health`, `/api/health/live`, `/api/health/ready`.
3. Check CloudWatch or local structured logs.
4. Confirm whether the issue is deployment-related.
5. Decide rollback or forward fix.

## Evidence To Capture

- Commit SHA.
- Request IDs.
- Error rate and 5xx count.
- Database readiness.
- Frontend route affected.
- Browser network error when relevant.

## Security Incident Notes

- Do not paste secrets into tickets or chats.
- If a token, password or key was exposed, rotate it before closing the incident.
- Preserve audit logs.
- Review CORS, cookies and authentication logs for suspicious activity.

## Post-Incident Review

Document:

- Root cause.
- Customer impact.
- Detection gap.
- Preventive test or monitor.
- Owner and due date for follow-up work.
