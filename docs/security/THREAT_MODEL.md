# Threat Model

## Assets

- User identities, password hashes and refresh tokens.
- Organization data and memberships.
- Clients, RUT values, catalog items, quotations and events.
- Runtime configuration and deployment secrets.
- PostgreSQL data and future S3 objects.

## Trust Boundaries

```text
Browser -> Angular app -> API over HTTP(S) -> Prisma -> PostgreSQL
Browser -> API cookies -> refresh-token store
API -> S3-compatible storage
CI -> package registry and GitHub
AWS edge -> CloudFront -> ECS API/RDS/S3
```

## Main Threats

| Threat | Risk | Mitigation |
| --- | --- | --- |
| Credential stuffing | Account takeover | Rate limiting, generic login errors, Argon2id |
| Refresh token theft | Session replay | HttpOnly cookie, token hash, rotation, logout revoke |
| Cross-tenant ID guessing | Data disclosure | Organization guards, RBAC checks, tests |
| XSS | Token/session abuse | No localStorage tokens, Angular escaping, SAST scan |
| CSRF | Unauthorized refresh/logout | SameSite=Lax, origin validation for sensitive cookie endpoints |
| CORS misconfiguration | Cookie leakage | Explicit allowed origins with credentials |
| SQL injection | Data compromise | Prisma parameterized queries; raw unsafe scan |
| Secret leakage | Credential compromise | Secret scan, ignored `.env`, no tracked runtime config |
| Supply chain compromise | Build compromise | pnpm lockfile, audit, SBOM generation |
| Stale frontend runtime config | Wrong API target | Generated runtime config, localized server verification |

## Abuse Cases To Keep Testing

- User from organization A tries to read or mutate organization B.
- Viewer role calls write endpoints directly.
- Approved quotation receives duplicate approve/cancel actions.
- Refresh token reused after rotation.
- API unavailable while frontend login reports a network error, not invalid credentials.

## Residual Risks

- Staging AWS is not validated yet.
- Coverage thresholds are below strict target.
- External SAST/DAST is not integrated yet.
- Alerts and incident drills are documented but not exercised.
