# Kaklen AWS Staging Infrastructure

This directory contains the credential-free Terraform foundation for Kaklen staging. It declares infrastructure but does not deploy resources. The root module is `environments/staging`; reusable modules live under `modules`.

## Architecture

```text
Internet
├── CloudFront + WAF
│   └── private S3 web bucket
│       ├── /es/
│       ├── /en/
│       └── /pt-BR/
└── HTTPS ALB + WAF
    └── private ECS Fargate tasks
        ├── private RDS PostgreSQL 16
        ├── private ElastiCache Redis
        ├── private application S3 bucket
        ├── Secrets Manager
        └── CloudWatch
```

ECS reaches ECR, CloudWatch Logs, Secrets Manager and S3 through private VPC endpoints. External HTTPS and SMTP egress require explicit provider CIDRs. RDS and Redis accept traffic only from the ECS security group.

## Modules

| Module | Responsibility |
| --- | --- |
| `networking` | VPC, two or more availability zones, public/private subnets, routes, Internet Gateway and configurable NAT. |
| `security` | Independent ALB, ECS, RDS, Redis and endpoint security groups plus private AWS service endpoints. |
| `load-balancer` | Public HTTPS ALB, API target group, liveness health check and regional WAF. |
| `ecs` | Fargate cluster, task definition, optional service, circuit breaker, autoscaling, roles and API logs. |
| `rds` | Private encrypted PostgreSQL 16, managed master credential, backups and Performance Insights. |
| `redis` | Private encrypted Redis-compatible replication group with optional authentication token. |
| `storage` | Private application/web buckets, application CMK, lifecycle, localized CloudFront routing, security headers and WAF. |
| `secrets` | Empty Secrets Manager containers; application values are populated outside Terraform. |
| `observability` | Dashboard, required alarms and optional encrypted SNS topic. |

Modules depend only on outputs from lower layers; there are no circular dependencies.

## Toolchain

- Terraform `1.15.8` selected by `.terraform-version`; configuration permits compatible versions from `1.10` through the `1.x` line.
- AWS provider `6.55.x`, fixed by `.terraform.lock.hcl`.
- TFLint `0.64.0` in CI.
- Trivy `0.72.0` in CI.

## Validation

```bash
pnpm infra:fmt
pnpm infra:validate
pnpm infra:lint
pnpm infra:security
pnpm infra:plan:staging
```

The staging plan uses placeholder credentials, disables refresh and writes only ignored local evidence under `.artifacts/infra`. It cannot create AWS resources. `infra:security` runs structural invariants and Trivy; the expected public ALB observation remains visible as an accepted design finding because the target topology exposes the API through that ALB. TLS-only listeners, WAF, rate control and ALB-only ECS ingress mitigate the exposure.

## Bootstrap Boundary

`enable_ecs_service` defaults to `false`. The first infrastructure phase creates network, data services, secret containers and a task definition without starting an API that lacks secrets. Before enabling the service, an operator must:

1. Replace all placeholder names, certificate ARNs, image reference and URLs in a non-versioned `terraform.tfvars`.
2. Set `offline_validation=false` and configure the encrypted remote backend.
3. Populate every application secret in Secrets Manager using an approved secret-management process.
4. Compose `DATABASE_URL` with `sslmode=require` and `REDIS_URL` with `rediss://`; neither value is a Terraform input.
5. Run the controlled migration task, verify its logs, then enable the ECS service.

No permanent AWS access key belongs in this repository or GitHub. Deployment automation should assume a scoped role through GitHub OIDC.

## Operational Documentation

- [Staging Terraform runbook](../docs/aws/TERRAFORM_STAGING.md)
- [Environment matrix](../docs/aws/ENVIRONMENT_MATRIX.md)
- [IAM baseline](../docs/aws/IAM.md)
- [Remote state](../docs/aws/REMOTE_STATE.md)
- [Cost controls](../docs/aws/COST_CONTROLS.md)
- [Cache and localized routing](../docs/aws/CACHE_STRATEGY.md)
- [Backup and restore](../docs/aws/BACKUP_RESTORE.md)
- [Rollback](../docs/aws/ROLLBACK.md)
- [Staging validation](../docs/aws/STAGING_VALIDATION.md)
