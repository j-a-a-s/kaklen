# Terraform Staging Runbook

## Scope

The staging root declares Kaklen's AWS runtime without deploying it. Local and CI validation require no AWS account and never execute resource creation. A real deployment needs an approved AWS account, GitHub OIDC role, DNS/certificates and operator-controlled secret values.

## Credential-Free Validation

Install the repository toolchain, then run:

```bash
pnpm infra:fmt
pnpm infra:validate
pnpm infra:lint
pnpm infra:security
pnpm infra:plan:staging
```

The plan uses `terraform.tfvars.example`, `offline_validation=true`, placeholder account identifier `000000000000`, `-refresh=false` and a local ignored plan file. A successful plan proves configuration consistency; it does not prove AWS permissions, quotas, DNS ownership or service availability.

## Deployment Inputs

Create an ignored `infra/environments/staging/terraform.tfvars` from the example and replace:

- availability zones and non-overlapping CIDRs;
- globally unique bucket names;
- API image pinned by ECR digest and its exact repository ARN;
- API and frontend origins;
- version, commit SHA and build timestamp;
- ACM certificate ARNs;
- approved external HTTPS and SMTP CIDRs;
- sizing, retention and resilience choices;
- `offline_validation=false`.

Do not put application secrets, database passwords, Redis credentials or AWS access keys in tfvars.

## Two-Phase Service Bootstrap

The initial plan keeps `enable_ecs_service=false`. This order prevents ECS from repeatedly starting before its secret values exist.

1. Provision the base resources through the approved deployment process.
2. Retrieve the RDS-managed master secret through a restricted administration role.
3. Create a least-privileged application database role through the controlled database administration procedure.
4. Populate the empty Secrets Manager containers listed by `application_secret_names`.
5. Store `DATABASE_URL` with `sslmode=require` and `REDIS_URL` with `rediss://`.
6. Run the migration task and inspect its CloudWatch logs.
7. Set `enable_ecs_service=true`, review the plan and deploy through the approved pipeline.

Secrets Manager versions are intentionally absent from Terraform so secret values do not enter plans or state.

## Controlled Prisma Migration

Build the API image's `migration-runner` target from the same commit and push it under an immutable ECR digest. Run a one-off Fargate task using the API task networking, execution role, secret references and this container command:

```text
node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
```

This is the container-safe equivalent of `pnpm db:migrate:deploy`. Do not run migrations from Terraform resource provisioners or API startup. The deployment pipeline must stop if the task exits nonzero, and the ECS service update must begin only after migration success.

## Localized Frontend Publication

Generate public runtime configuration and build all locales:

```bash
PUBLIC_API_BASE_URL=https://api.staging.example.invalid/api pnpm web:runtime-config
pnpm --filter @kaklen/web build:es
pnpm --filter @kaklen/web build:en
pnpm --filter @kaklen/web build:pt-BR
```

The physical roots are:

```text
apps/web/dist/web/es/browser
apps/web/dist/web/en/browser
apps/web/dist/web/pt-BR/browser
```

Upload each directory below the matching `es/`, `en/` or `pt-BR/` key. Upload hashed assets with one-year immutable cache metadata. Upload each locale's `index.html` with `no-cache,max-age=0`, and upload `runtime-config.js` plus `runtime-config.json` with `no-store`. Runtime config is public metadata and can be replaced independently of bundles when an endpoint or environment label changes.

CloudFront rewrites extensionless routes only to that locale's `index.html`; missing `.js`, `.css`, `.json`, images and fonts remain real origin failures. Root requests redirect according to `Accept-Language`, falling back to `/es/login`.

## Health And Deployment Checks

After service enablement, validate over HTTPS:

```text
/api/health
/api/health/live
/api/health/ready
/es/login
/en/login
/pt-BR/login
```

The ALB uses `/api/health/live`; deployment readiness additionally requires `/api/health/ready`. Confirm WAF metrics, target health, logs and all CloudWatch alarms before recording external staging evidence.

## Rollback

- ECS circuit breaker automatically restores the previous task definition when a rollout cannot become healthy.
- Manual API rollback selects the prior immutable task definition after database compatibility review.
- Frontend rollback restores the prior versioned S3 objects and invalidates only locale HTML and runtime config paths.
- Database rollback follows the snapshot/restore runbook; destructive schema reversal is never automatic.

No resource deployment was executed as part of Sprint 4A.
