# Local to AWS runtime

## Local

Docker Compose runs PostgreSQL locally. The API uses plain PostgreSQL, local CORS origins, simulated storage, and development runtime config.

## AWS

- API runs as a stateless ECS Fargate service behind an Application Load Balancer.
- PostgreSQL runs in private Amazon RDS with SSL required in production.
- Files live in a private S3 bucket and are accessed through short-lived signed URLs.
- Angular builds are static files served from private S3 through CloudFront.
- Logs are JSON lines written to stdout/stderr and shipped to CloudWatch Logs with `awslogs`.
- Secrets are injected from Secrets Manager or Parameter Store into ECS tasks.

## Environment variables

Required in production:

- `NODE_ENV=production`
- `PORT`
- `DATABASE_URL`
- `DATABASE_SSL=true`
- `APP_VERSION`
- `COMMIT_SHA`
- `CORS_ALLOWED_ORIGINS`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `AWS_REGION`
- `AWS_S3_BUCKET`
- `LOG_LEVEL`
- `TRUST_PROXY=true`

Optional:

- `AWS_S3_ENDPOINT` for LocalStack-compatible development.
- `AWS_CLOUDFRONT_DOMAIN` for future public asset URL composition.
- `PUBLIC_API_BASE_URL`, `PUBLIC_APP_ENVIRONMENT` for frontend runtime config.

## Build

The API image is built with:

```bash
docker build --platform linux/amd64 -f apps/api/Dockerfile -t kaklen-api:test .
```

The frontend runtime config is generated with:

```bash
PUBLIC_API_BASE_URL=https://api.example.com/api pnpm web:runtime-config
```

Upload `index.html` with `Cache-Control: no-cache`. Upload hashed assets with long immutable cache headers.

## Migrations

Do not run migrations automatically in API bootstrap. Run an ECS one-off task using the `migration-runner` Docker target or command:

```bash
pnpm db:migrate:deploy
```

Run it before updating the ECS service.

## Rollback

Rollback is image-based: redeploy the previous ECS task definition after confirming database compatibility. Schema changes should be backward compatible across at least one deployment.
