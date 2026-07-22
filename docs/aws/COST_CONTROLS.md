# AWS Staging Cost Controls

Costs vary by region, traffic, storage and retention. This foundation records qualitative drivers rather than stale prices. Review the current AWS calculator before deployment and tag all resources for cost allocation.

| Service | Primary driver | Staging control | Tradeoff |
| --- | --- | --- | --- |
| NAT Gateway | Hours and processed bytes | One shared NAT by default; disable it when all required outbound paths use VPC endpoints or approved egress. | A single NAT is not zone-redundant. |
| VPC endpoints | Interface endpoint hours and data | Create only endpoints required by ECS: ECR API/DKR, Logs, Secrets Manager and S3 gateway. | Interface endpoints add fixed cost but remove broad internet egress. |
| ALB and WAF | Hours, capacity units and inspected requests | One ALB, managed common rules and a rate rule. | Security controls remain enabled even at low traffic. |
| ECS Fargate | CPU, memory and task duration | One small task initially; autoscaling maximum is configurable. | A single task reduces availability during replacement. |
| RDS PostgreSQL | Instance, storage, backups and Performance Insights | Small Graviton class, gp3 autoscaling and seven-day backups. | Single-AZ lowers resilience; encryption and deletion protection stay enabled. |
| ElastiCache Redis | Node count and class | One small Graviton node for staging. | Automatic failover requires at least two nodes. TLS and private access stay enabled. |
| S3 and CloudFront | Stored versions, requests, transfer and invalidations | Lifecycle old versions, immutable hashed assets, `PriceClass_100`, targeted invalidations. | Broader edge coverage may be needed for production audiences. |
| CloudWatch and SNS | Ingested logs, retention, metrics and notifications | Thirty-day logs; required alarms; SNS disabled until a receiver is approved. | Shorter retention reduces investigation history. |

Cost reduction must not disable bucket public-access blocks, encryption, TLS, WAF, secret isolation, scoped security groups or remote-state protection. Resilience choices such as single NAT, single-AZ RDS and one Redis node must be reassessed before production.
