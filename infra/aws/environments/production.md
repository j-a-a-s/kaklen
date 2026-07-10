# Production environment

Purpose: customer-facing runtime.

- ALB in public subnets.
- ECS API tasks and RDS in private subnets.
- Multi-AZ RDS where budget allows.
- S3 private with CloudFront origin access control.
- Secrets Manager for application secrets.
- CloudWatch retention and alarms configured before launch.
