# AWS Environment Matrix

This matrix is generated from the canonical environment contract and `infra/environment-mapping.json`.
Run `pnpm infra:validate` to detect contract drift. Secret values are never rendered here or passed as plain Terraform variables.

| Variable | Classification | Secret | Source | Supplied by | Terraform generates | ECS | Frontend | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `API_PORT` | runtime | no | var.api_port | platform configuration | no | plain environment | not used | Matches the ECS container and target group port. |
| `APP_PUBLIC_URL` | runtime | no | var.app_public_url | platform operator | no | plain environment | deployment origin | Must be the exact public frontend origin. |
| `APP_VERSION` | runtime | no | var.app_version | release pipeline | no | plain environment | runtime-config | Shared API and web release identifier. |
| `APP_WEB_URL` | runtime | no | var.app_web_url | platform operator | no | plain environment | not used | Primary invitation-link origin. |
| `AUTH_ALLOWED_ORIGINS` | runtime | no | var.app_public_url | platform operator | no | plain environment | not used | Single staging origin; credentials never use a wildcard. |
| `AUTH_EMAIL_ENABLED` | runtime | no | staging policy | Terraform root module | yes | plain environment | not used | Enabled for transactional staging validation. |
| `AWS_CLOUDFRONT_DOMAIN` | runtime | no | future private object-delivery distribution | platform operator | no | not injected | not used | The frontend distribution is deliberately not reused for private business objects. |
| `AWS_REGION` | runtime | no | var.aws_region | platform operator | no | plain environment | not used | Region used by the application S3 client. |
| `AWS_S3_BUCKET` | runtime | no | module.storage.application_bucket_name | Terraform | yes | plain environment | not used | Private application object bucket. |
| `AWS_S3_ENDPOINT` | runtime | no | AWS SDK default endpoint resolution | AWS SDK | no | not injected | not used | Only local S3-compatible environments override this value. |
| `BUILD_TIME` | runtime | no | var.build_time | release pipeline | no | plain environment | runtime-config | Optional ISO-8601 image build timestamp. |
| `COMMERCIAL_EMAIL_ENABLED` | runtime | no | staging policy | Terraform root module | yes | plain environment | runtime-config | Disabled until external commercial email validation exists. |
| `COMMIT_SHA` | runtime | no | var.commit_sha | release pipeline | no | plain environment | runtime-config | Immutable source revision. |
| `COOKIE_SECURE` | runtime | no | staging security policy | Terraform root module | yes | plain environment | not used | Always true in AWS staging. |
| `CORS_ALLOWED_ORIGINS` | runtime | no | var.app_public_url | platform operator | no | plain environment | not used | Exact credentialed frontend origin. |
| `DATABASE_SSL` | runtime | no | staging security policy | Terraform root module | yes | plain environment | not used | RDS parameter group also enforces TLS. |
| `DATABASE_URL` | runtime | yes | Secrets Manager application secret | platform operator after RDS creation | no | secret reference | prohibited | Composed out of band with sslmode=require; the value never enters Terraform state. |
| `EMAIL_VERIFICATION_EXPIRES_MINUTES` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | Transactional token lifetime. |
| `JWT_ACCESS_EXPIRES_SECONDS` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | Fifteen-minute access token lifetime. |
| `JWT_ACCESS_SECRET` | runtime | yes | Secrets Manager application secret | secret-generation procedure | no | secret reference | prohibited | Independent random signing value populated out of band. |
| `JWT_REFRESH_EXPIRES_SECONDS` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | Seven-day refresh token lifetime. |
| `JWT_REFRESH_SECRET` | runtime | yes | Secrets Manager application secret | secret-generation procedure | no | secret reference | prohibited | Independent from the access-token secret. |
| `LOG_LEVEL` | runtime | no | staging observability policy | Terraform root module | yes | plain environment | not used | Information-level structured logging. |
| `MAIL_CONNECTION_TIMEOUT_MS` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | SMTP connection timeout. |
| `MAIL_FROM` | runtime | no | var.mail_from | email operator | no | plain environment | not used | Must be verified with the selected provider before service enablement. |
| `MAIL_GREETING_TIMEOUT_MS` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | SMTP greeting timeout. |
| `MAIL_HOST` | runtime | no | var.mail_host | email operator | no | plain environment | not used | External SMTP hostname. |
| `MAIL_PASSWORD` | runtime | yes | optional future Secrets Manager secret | email operator | no | not injected | prohibited | Add only when the selected SMTP provider requires password authentication. |
| `MAIL_PORT` | runtime | no | var.mail_port | email operator | no | plain environment | not used | Must align with explicit SMTP egress CIDRs. |
| `MAIL_SECURE` | runtime | no | staging SMTP policy | Terraform root module | yes | plain environment | not used | Port 587 upgrades with STARTTLS rather than implicit TLS. |
| `MAIL_SOCKET_TIMEOUT_MS` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | SMTP socket timeout. |
| `MAIL_USER` | runtime | no | optional email provider identity | email operator | no | not injected | not used | Add together with MAIL_PASSWORD when provider authentication requires it. |
| `NODE_ENV` | runtime | no | staging runtime policy | Terraform root module | yes | plain environment | not used | Always production inside the AWS runtime. |
| `ORGANIZATION_INVITATION_EXPIRES_SECONDS` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | Organization invitation lifetime. |
| `PASSWORD_RESET_EXPIRES_MINUTES` | runtime | no | application default policy | Terraform root module | yes | plain environment | not used | Password recovery token lifetime. |
| `PAYMENT_GATEWAY` | runtime | no | staging integration policy | Terraform root module | yes | plain environment | not used | Remains sandbox in staging. |
| `PAYMENT_SANDBOX_SECRET` | runtime | yes | Secrets Manager application secret | integration operator | no | secret reference | prohibited | Sandbox callback secret populated out of band. |
| `PORT` | runtime | no | var.api_port | platform configuration | no | plain environment | not used | Primary NestJS listening port. |
| `PUBLIC_API_BASE_URL` | runtime | no | var.api_public_url plus /api | web deployment pipeline | no | not injected | runtime-config | Written into each localized runtime-config file. |
| `PUBLIC_APP_ENVIRONMENT` | runtime | no | var.environment | Terraform root module | yes | plain environment | runtime-config | Public staging label, never a secret. |
| `RATE_LIMIT_HASH_SECRET` | runtime | yes | Secrets Manager application secret | secret-generation procedure | no | secret reference | prohibited | Distributed throttling HMAC secret. |
| `REDIS_URL` | runtime | yes | Secrets Manager application secret | platform operator after ElastiCache creation | no | secret reference | prohibited | Composed out of band as a rediss URL; the value never enters Terraform state. |
| `SESSION_IDLE_SECONDS` | runtime | no | web deployment policy | web deployment pipeline | no | not injected | runtime-config | Browser idle-session duration. |
| `SESSION_WARNING_SECONDS` | runtime | no | web deployment policy | web deployment pipeline | no | not injected | runtime-config | Browser idle warning threshold. |
| `SWAGGER_ENABLED` | runtime | no | staging exposure policy | Terraform root module | yes | plain environment | not used | Disabled because NODE_ENV is production. |
| `TRUST_PROXY` | runtime | no | ALB topology policy | Terraform root module | yes | plain environment | not used | Required for trusted ALB proxy handling. |
| `WEB_DIST_ROOT` | runtime | no | web build pipeline | build tooling | no | not injected | build only | CloudFront serves uploaded artifacts and does not run the local web server. |
| `WEB_PORT` | runtime | no | web build pipeline | build tooling | no | not injected | build only | Not applicable to S3 and CloudFront hosting. |
| `WHATSAPP_HASH_SECRET` | runtime | yes | Secrets Manager application secret | secret-generation procedure | no | secret reference | prohibited | Operational identifier HMAC secret. |
| `WHATSAPP_MODE` | runtime | no | staging integration policy | Terraform root module | yes | plain environment | not used | Manual until the external provider is validated. |

## Boundary Decisions

- `DATABASE_URL` and `REDIS_URL` are assembled and populated after their managed services exist. Terraform creates only empty secret containers, so credentials do not enter state or plans.
- `AWS_CLOUDFRONT_DOMAIN` remains unset because the distribution in this foundation serves the web application, not private organization files.
- Optional SMTP credentials are added only when the chosen provider requires them; the default staging plan does not create unused secret dependencies.
- Frontend runtime config contains public metadata only and is uploaded separately for `es`, `en` and `pt-BR`.
