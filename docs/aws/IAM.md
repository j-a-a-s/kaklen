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

- `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:HeadObject` on `arn:aws:s3:::<bucket>/organizations/*`.
- `s3:ListBucket` on the bucket with a prefix condition for `organizations/`.
- `secretsmanager:GetSecretValue` only for application secrets required by this service.
- No broad administrator permissions.

## GitHub deployment role

Future deployment automation should use GitHub OIDC and a role limited to:

- pushing images to the Kaklen ECR repository;
- registering ECS task definitions;
- updating the ECS service;
- running the one-off migration task;
- reading deployment-time parameters.

Avoid `Resource: "*"` except for AWS actions that do not support resource scoping, such as `ecr:GetAuthorizationToken`, and document each exception.
