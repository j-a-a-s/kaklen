# Staging environment

Purpose: production-like validation before the first external client.

- Same topology as production.
- Separate RDS, S3, secrets and CloudWatch log groups.
- Enables release rehearsals and rollback testing.
