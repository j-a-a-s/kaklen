# Kaklen AWS runtime foundation

This directory documents the intended AWS runtime. It does not create AWS infrastructure and should not run cost-incurring commands.

Core services:

- ECR stores the API image.
- ECS Fargate runs the stateless NestJS API.
- ALB exposes HTTPS health-checked traffic to ECS.
- RDS PostgreSQL stores relational data.
- S3 stores private frontend assets and application files.
- CloudFront serves the frontend and performs SPA fallback to `index.html`.
- Secrets Manager or Parameter Store injects secrets into ECS.
- CloudWatch Logs receives JSON stdout/stderr from containers.
- Route 53 and ACM provide DNS and TLS.
