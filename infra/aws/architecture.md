# AWS architecture

## Network

- Public subnets: Application Load Balancer and NAT gateways if needed.
- Private subnets: ECS API tasks and RDS PostgreSQL.
- RDS is never publicly accessible.

## Frontend

Angular outputs static files. S3 is private and CloudFront uses origin access control. Configure CloudFront custom error responses so SPA routes fall back to `/index.html`.

## Backend

The API container is stateless and safe to scale horizontally. ECS health checks use `/api/health/live`; deployment readiness can use `/api/health/ready`.

## Database

RDS PostgreSQL requires SSL in production. Prisma migrations run as a separate ECS task before service rollout.

## Files

Application files use private S3 keys under `organizations/{organizationId}/...` and short-lived signed URLs. The API never depends on persistent local disk.
