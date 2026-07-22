# AWS Staging Validation

## Status

AWS staging real is not validated in this environment. Therefore AWS cannot score 10/10 and `pnpm release:check:strict` must remain blocked unless `AWS_STAGING_VALIDATED=true` is set by a real staging run with evidence.

Sprint 4A provides a credential-free Terraform plan and static security evidence. This validates configuration, not resource creation or external service behavior. See the [Terraform staging runbook](TERRAFORM_STAGING.md).

## Required Infrastructure

- VPC with public/private subnets.
- Security groups for ALB/ECS/RDS/Redis.
- ECS Fargate service for API.
- RDS PostgreSQL 16 with backups.
- ElastiCache Redis if the runtime depends on Redis.
- S3 bucket for static assets and future object storage.
- CloudFront distribution for localized frontend.
- ACM certificate and real HTTPS domain.
- Secrets Manager entries for database, JWT and refresh secrets.
- CloudWatch logs and alarms.
- Migration job or documented deployment step.
- WAF on the frontend and API entry points.
- Private VPC endpoints for ECR, Logs, Secrets Manager and S3.

## Validation Checklist

- API `/api/health`, `/api/health/live`, `/api/health/ready` respond over HTTPS.
- Swagger is reachable only as intended for staging.
- Frontend `/es/login`, `/en/login`, `/pt-BR/login` renders through CloudFront.
- `runtime-config.json` points to the staging API.
- Login succeeds with a staging-only account.
- Refresh cookie is `HttpOnly`, `Secure` and `SameSite=Lax`.
- CORS allows only the staging frontend origin with credentials.
- RDS migrations are applied and `ready` fails when DB is unavailable.
- CloudFront serves fresh `index.html` and no stale runtime config after deploy.
- Static assets use immutable cache policy.
- Logs appear in CloudWatch with request id.
- Rollback procedure has been tested at least once.

## Evidence Required For 10/10

Capture and attach:

- Deployment SHA.
- API health responses.
- Browser network headers for cookies and CORS.
- CloudFront cache behavior screenshot or exported config.
- RDS backup setting.
- CloudWatch alarm state.
- Rollback drill result.
