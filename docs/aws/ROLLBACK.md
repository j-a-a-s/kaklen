# AWS Rollback

## Goal

Restore the previous known-good API task definition and frontend static build without data loss.

## API Rollback

1. Identify the previous healthy ECS task definition revision.
2. Update the ECS service to that revision.
3. Wait until the service reaches steady state.
4. Validate:
   - `/api/health`
   - `/api/health/live`
   - `/api/health/ready`
   - login with staging account
5. Check CloudWatch logs for startup errors.

## Frontend Rollback

1. Identify the previous frontend artifact version in S3.
2. Restore `index.html`, localized `browser` directories and runtime config for:
   - `/es`
   - `/en`
   - `/pt-BR`
3. Create a CloudFront invalidation for:
   - `/es/index.html`
   - `/en/index.html`
   - `/pt-BR/index.html`
   - `/*/runtime-config.json`
   - `/*/runtime-config.js`
4. Validate all localized login routes.

## Database Rollback

Database rollback is not automatic. Prefer forward migrations. If a destructive migration reaches staging, stop traffic, restore from RDS backup or snapshot, then redeploy the matching API revision.

## Communication

- Record incident start time, impacted version and rollback SHA.
- Announce when API and frontend are healthy.
- Attach health responses and CloudWatch evidence.
