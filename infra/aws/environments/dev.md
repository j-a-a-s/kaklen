# Dev environment

Purpose: internal AWS validation with minimal scale.

- One ECS service for API.
- One RDS PostgreSQL instance in private subnets.
- One private S3 bucket for frontend/assets.
- CloudFront distribution with dev domain.
- Secrets isolated from production.
