# Backup And Restore

## PostgreSQL RDS

Required staging settings:

- Automated backups enabled.
- Retention period documented.
- Point-in-time recovery enabled when supported by the chosen instance class.
- Snapshots before risky migrations.
- Restore drill executed before production launch.

## Restore Drill

1. Create or select a recent RDS snapshot.
2. Restore into an isolated staging database instance.
3. Point a temporary API task to the restored database.
4. Run:
   - `pnpm db:status`
   - API `/api/health/ready`
   - one read path for organizations, clients, catalog, quotations and events.
5. Confirm no production secrets are copied into a lower environment.

## S3 Static Assets

- Keep build artifacts versioned by commit SHA.
- Keep localized bundles for `es`, `en` and `pt-BR`.
- Runtime config must be environment-specific and generated per deploy.

## Recovery Objectives

Initial alpha target:

- RPO: 24 hours for staging.
- RTO: 2 hours for staging.

These values must be revisited before production.
