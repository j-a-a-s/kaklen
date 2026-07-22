# AWS IAM baseline

Kaklen should deploy with GitHub OIDC assuming a deployment role. Do not store permanent AWS access keys in GitHub, images, ECS tasks, or the repository.

## ECS task execution role

Used by ECS to pull images and write container logs.

- `ecr:GetAuthorizationToken` on `*` because AWS requires it.
- `ecr:BatchCheckLayerAvailability`, `ecr:GetDownloadUrlForLayer`, `ecr:BatchGetImage` scoped to the Kaklen API ECR repository.
- `logs:CreateLogStream`, `logs:PutLogEvents` scoped to the ECS log group.
- `secretsmanager:GetSecretValue` scoped only to secrets injected by ECS.

## ECS application task role

Used by the API container at runtime.

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on `arn:aws:s3:::<bucket>/organizations/*`. S3 HEAD authorization is covered by `s3:GetObject`.
- `s3:ListBucket` on the bucket with a prefix condition for `organizations/`.
- `kms:Encrypt`, `kms:Decrypt`, `kms:GenerateDataKey`, and `kms:DescribeKey` scoped to the application object's customer-managed key.
- `secretsmanager:GetSecretValue` only for application secrets required by this service.
- No broad administrator permissions.

The Terraform module implements these permissions as separate inline policies. Secrets are read by the execution role for ECS injection; application code does not receive a general Secrets Manager permission.

## GitHub deployment role

Future deployment automation should use GitHub OIDC and a role limited to:

- pushing images to the Kaklen ECR repository;
- registering ECS task definitions;
- updating the ECS service;
- running the one-off migration task;
- reading deployment-time parameters.

Avoid `Resource: "*"` except for AWS actions that do not support resource scoping, such as `ecr:GetAuthorizationToken`, and document each exception.

## Network Enforcement

IAM is paired with network boundaries:

- ECS image pulls, secret reads and log writes use interface VPC endpoints.
- S3 access uses a gateway endpoint and object ARNs restricted to `organizations/*`.
- The API has no general HTTPS egress; external providers require explicit CIDRs.
- RDS and Redis security groups accept only the ECS task security group.

## Public Entry Points

The frontend CloudFront distribution and API ALB are intentional public entry points. Both use WAF managed common protections and rate rules. The ALB has only an HTTPS listener with an ACM certificate, and its security group can forward only to the API task port.
