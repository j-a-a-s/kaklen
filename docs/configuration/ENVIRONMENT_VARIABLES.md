# Variables de entorno

Este documento se genera desde `environment-variables.json` mediante `pnpm env:update`.
El manifiesto es la única fuente de clasificación, obligatoriedad y consumidores.

## Runtime productivo

| Variable | Alcance | Ambientes | Obligatoria | Tipo | Default | Consumidores | Descripción |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `API_PORT` | runtime | development, test, production, ci | no | non-secret | `3000` | api, scripts, workflow | Fallback API port used by runtime and local orchestration. |
| `APP_PUBLIC_URL` | runtime | development, test, production, ci | production | non-secret | `http://localhost:4200` | api, scripts, workflow | Public web origin used to build verification, recovery and portal links. |
| `APP_VERSION` | runtime | development, test, production, ci | production | non-secret | `0.1.0` | api, docker, scripts | Application version exposed by runtime config and health endpoints. |
| `APP_WEB_URL` | runtime | development, test, production, ci | production | non-secret | `http://localhost:4200` | api | Primary web origin used by organization invitations. |
| `AUTH_ALLOWED_ORIGINS` | runtime | development, test, production, ci | production | non-secret | `http://localhost:4200` | api, scripts, workflow | Comma-separated origin allow-list for refresh and logout requests. |
| `AUTH_EMAIL_ENABLED` | runtime | development, test, production, ci | no | non-secret | `true` | api, workflow | Enables transactional authentication email delivery. |
| `AWS_CLOUDFRONT_DOMAIN` | runtime | development, test, production, ci | no | non-secret | none | api | Optional CloudFront domain used for public object delivery. |
| `AWS_REGION` | runtime | development, test, production, ci | production | non-secret | `us-east-1` | api, workflow | AWS region used by the S3 client. |
| `AWS_S3_BUCKET` | runtime | development, test, production, ci | production | non-secret | `kaklen-local` | api, workflow | S3 bucket that stores application objects. |
| `AWS_S3_ENDPOINT` | runtime | development, test, production, ci | no | non-secret | none | api | Optional S3-compatible endpoint override. |
| `BUILD_TIME` | runtime | development, test, production, ci | no | non-secret | none | api, docker, scripts | ISO timestamp embedded in runtime metadata. |
| `COMMERCIAL_EMAIL_ENABLED` | runtime | development, test, production, ci | no | non-secret | `false` | api, scripts, workflow | Enables commercial email capabilities independently from auth email. |
| `COMMIT_SHA` | runtime | development, test, production, ci | production | non-secret | `local` | api, docker, scripts, workflow | Source revision exposed by runtime metadata. |
| `COOKIE_SECURE` | runtime | development, test, production, ci | production | non-secret | `false` | api, workflow | Requires HTTPS-only authentication cookies. |
| `CORS_ALLOWED_ORIGINS` | runtime | development, test, production, ci | production | non-secret | `http://localhost:4200` | api, scripts, workflow | Comma-separated CORS origin allow-list. |
| `DATABASE_SSL` | runtime | development, test, production, ci | production | non-secret | `false` | api, scripts, workflow | Enforces TLS for PostgreSQL and requires sslmode=require in production. |
| `DATABASE_URL` | runtime | development, test, production, ci | production | secret | none | api, scripts, workflow | Prisma PostgreSQL connection URL. |
| `EMAIL_VERIFICATION_EXPIRES_MINUTES` | runtime | development, test, production, ci | no | non-secret | `1440` | api, scripts | Email-verification token lifetime in minutes. |
| `JWT_ACCESS_EXPIRES_SECONDS` | runtime | development, test, production, ci | no | non-secret | `900` | api | Access-token lifetime in seconds. |
| `JWT_ACCESS_SECRET` | runtime | development, test, production, ci | production | secret | none | api, scripts, workflow | Cryptographic secret used to sign access tokens. |
| `JWT_REFRESH_EXPIRES_SECONDS` | runtime | development, test, production, ci | no | non-secret | `604800` | api | Refresh-token lifetime in seconds. |
| `JWT_REFRESH_SECRET` | runtime | development, test, production, ci | production | secret | none | api, scripts, workflow | Independent cryptographic secret used for refresh tokens. |
| `LOG_LEVEL` | runtime | development, test, production, ci | no | non-secret | `debug` | api, scripts | Structured API logging threshold. |
| `MAIL_CONNECTION_TIMEOUT_MS` | runtime | development, test, production, ci | no | non-secret | `5000` | api | SMTP connection timeout in milliseconds. |
| `MAIL_FROM` | runtime | development, test, production, ci | production | non-secret | `Kaklen <no-reply@kaklen.local>` | api, scripts, workflow | Sender identity for application email. |
| `MAIL_GREETING_TIMEOUT_MS` | runtime | development, test, production, ci | no | non-secret | `5000` | api | SMTP greeting timeout in milliseconds. |
| `MAIL_HOST` | runtime | development, test, production, ci | production | non-secret | `localhost` | api, scripts, workflow | SMTP server hostname. |
| `MAIL_PASSWORD` | runtime | development, test, production, ci | no | secret | none | api | Optional SMTP password paired with MAIL_USER. |
| `MAIL_PORT` | runtime | development, test, production, ci | no | non-secret | `1025` | api, scripts, workflow | SMTP server port. |
| `MAIL_SECURE` | runtime | development, test, production, ci | no | non-secret | `false` | api, scripts, workflow | Enables implicit TLS for SMTP. |
| `MAIL_SOCKET_TIMEOUT_MS` | runtime | development, test, production, ci | no | non-secret | `10000` | api | SMTP socket timeout in milliseconds. |
| `MAIL_USER` | runtime | development, test, production, ci | no | non-secret | none | api | Optional SMTP username paired with MAIL_PASSWORD. |
| `NODE_ENV` | runtime | development, test, production, ci | production | non-secret | `development` | api, docker, scripts, workflow | Node runtime environment selector. |
| `ORGANIZATION_INVITATION_EXPIRES_SECONDS` | runtime | development, test, production, ci | no | non-secret | `259200` | api | Organization invitation lifetime in seconds. |
| `PASSWORD_RESET_EXPIRES_MINUTES` | runtime | development, test, production, ci | no | non-secret | `30` | api, scripts | Password-reset token lifetime in minutes. |
| `PAYMENT_GATEWAY` | runtime | development, test, production, ci | no | non-secret | `sandbox` | api, workflow | Configured payment gateway mode. |
| `PAYMENT_SANDBOX_SECRET` | runtime | development, test, production, ci | production | secret | none | api, workflow | Cryptographic secret for sandbox payment callbacks. |
| `PORT` | runtime | development, test, production, ci | no | non-secret | `3000` | api, docker, scripts, workflow | Primary API listening port. |
| `PUBLIC_API_BASE_URL` | runtime | development, test, production, ci | no | non-secret | `http://localhost:3000/api` | docker, scripts | API base URL written into public web runtime config. |
| `PUBLIC_APP_ENVIRONMENT` | runtime | development, test, production, ci | no | non-secret | `development` | api, docker, scripts | Public environment label exposed by web and health metadata. |
| `RATE_LIMIT_HASH_SECRET` | runtime | development, test, production, ci | production | secret | none | api, workflow | HMAC secret for distributed rate-limit identifiers. |
| `REDIS_URL` | runtime | development, test, production, ci | production | secret | none | api, workflow | Redis connection URL for distributed limits and BullMQ; production requires rediss:// on a non-loopback managed endpoint. |
| `SESSION_IDLE_SECONDS` | runtime | development, test, production, ci | no | non-secret | `300` | scripts | Frontend idle-session timeout in seconds. |
| `SESSION_WARNING_SECONDS` | runtime | development, test, production, ci | no | non-secret | `240` | scripts | Frontend idle warning threshold in seconds. |
| `SWAGGER_ENABLED` | runtime | development, test, production, ci | no | non-secret | `true` | api, workflow | Enables Swagger outside production; production always disables it. |
| `TRUST_PROXY` | runtime | development, test, production, ci | no | non-secret | `false` | api | Enables trusted proxy handling for the deployed topology. |
| `WEB_DIST_ROOT` | runtime | development, test, production, ci | no | non-secret | `apps/web/dist/web` | docker, scripts | Localized Angular build root served by web runtime tooling. |
| `WEB_PORT` | runtime | development, test, production, ci | no | non-secret | `4200` | docker, scripts, workflow | Localized frontend runtime port. |
| `WHATSAPP_HASH_SECRET` | runtime | development, test, production, ci | production | secret | none | api, workflow | HMAC secret for WhatsApp operational identifiers. |
| `WHATSAPP_MODE` | runtime | development, test, production, ci | no | non-secret | `manual` | api, workflow | Selects manual or provider-backed WhatsApp delivery. |

## Desarrollo local

| Variable | Alcance | Ambientes | Obligatoria | Tipo | Default | Consumidores | Descripción |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `AWS_DEFAULT_REGION` | development | development, test, ci | no | non-secret | `us-east-1` | docker | Region passed to the local LocalStack container. |
| `KAKLEN_CONFIRM_DB_RESET` | development | development, test | no | non-secret | none | scripts | Explicit confirmation phrase for destructive local database reset. |
| `MAILPIT_SMTP_PORT` | development | development, test, ci | no | non-secret | `1025` | api, docker, scripts, workflow | Published SMTP port for local Mailpit. |
| `MAILPIT_WEB_PORT` | development | development, test, ci | no | non-secret | `8025` | docker, scripts, workflow | Published HTTP port for local Mailpit. |
| `POSTGRES_DB` | development | development, test, ci | no | non-secret | `kaklen_dev` | docker, scripts, workflow | Database created by local and CI PostgreSQL containers. |
| `POSTGRES_PASSWORD` | development | development, test, ci | no | secret | none | docker, scripts, workflow | Known local PostgreSQL container password. |
| `POSTGRES_PORT` | development | development, test, ci | no | non-secret | `5432` | api, docker, scripts | Published local PostgreSQL port. |
| `POSTGRES_USER` | development | development, test, ci | no | non-secret | `kaklen` | docker, scripts, workflow | User created by local and CI PostgreSQL containers. |
| `REDIS_PORT` | development | development, test, ci | no | non-secret | `6379` | api, docker, scripts, workflow | Published Redis port for local and CI services. |
| `SERVICES` | development | development, test, ci | no | non-secret | `s3` | docker | LocalStack service allow-list. |

## Testing

| Variable | Alcance | Ambientes | Obligatoria | Tipo | Default | Consumidores | Descripción |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `CHROME_BIN` | test | development, test, ci | no | non-secret | none | scripts | Optional Chrome or Chromium executable for Angular unit tests. |
| `E2E_API_BASE_URL` | test | test, ci | no | non-secret | `http://localhost:3000` | scripts | API origin used by Playwright journeys. |
| `E2E_COMMAND_TIMEOUT_MS` | test | test, ci | no | non-secret | `300000` | scripts | Maximum duration for E2E setup commands. |
| `E2E_FORCE_TIMEOUT_MS` | test | test, ci | no | non-secret | `2000` | scripts | Grace period before force-stopping E2E child processes. |
| `E2E_MAILPIT_BASE_URL` | test | test, ci | no | non-secret | `http://localhost:8025` | scripts | Mailpit HTTP origin used by email E2E tests. |
| `E2E_SHUTDOWN_TIMEOUT_MS` | test | test, ci | no | non-secret | `5000` | scripts | Graceful shutdown timeout for E2E services. |
| `E2E_STARTUP_TIMEOUT_MS` | test | test, ci | no | non-secret | `120000` | scripts | Health-check timeout while starting E2E services. |
| `E2E_WEB_BASE_URL` | test | test, ci | no | non-secret | `http://localhost:4200` | scripts | Localized web origin used by Playwright journeys. |
| `E2E_WEB_REQUEST_LOGS` | test | test, ci | no | non-secret | `false` | scripts | Enables per-request diagnostics in the localized E2E server. |

## CI e internas

| Variable | Alcance | Ambientes | Obligatoria | Tipo | Default | Consumidores | Descripción |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `ACCESSIBILITY_REUSE_E2E` | internal | test, ci | no | non-secret | `false` | scripts | Reuses complete E2E accessibility evidence inside the canonical pipeline. |
| `API_TEST_WITH_COVERAGE` | internal | test, ci | no | non-secret | `false` | scripts | Enables API coverage during the full workspace test task. |
| `APP_ENVIRONMENT` | internal | development, test, ci | no | non-secret | none | scripts | Legacy safety signal inspected only by demo-data protection. |
| `AWS_STAGING_VALIDATED` | ci | ci | no | non-secret | `false` | scripts | External evidence flag confirming AWS staging validation. |
| `CI` | ci | test, ci | no | non-secret | `false` | api, docker, scripts | Standard continuous-integration execution signal. |
| `COMMIT_RANGE` | ci | ci | no | non-secret | `HEAD` | scripts, workflow | Git range checked by conventional-commit verification. |
| `COVERAGE_REUSE` | internal | test, ci | no | non-secret | `false` | scripts | Reuses coverage generated by the canonical workspace test task. |
| `DB_SKIP_PRISMA_GENERATE` | internal | test, ci | no | non-secret | `false` | scripts | Skips duplicate Prisma generation in the canonical pipeline. |
| `E2E_REUSE_ARTIFACTS` | internal | test, ci | no | non-secret | `false` | scripts | Reuses builds produced earlier by the quality graph. |
| `GH_TOKEN` | internal | ci | no | secret | none | scripts, workflow | GitHub Actions token used to verify repository governance metadata. |
| `I18N_SKIP_BUILD` | internal | test, ci | no | non-secret | `false` | scripts | Reuses localized builds during server verification. |
| `INFRA_INIT_TIMEOUT_MS` | internal | development, test, ci | no | non-secret | `600000` | scripts, workflow | Secondary timeout for Terraform and TFLint initialization steps. |
| `INFRA_PLAN_TIMEOUT_MS` | internal | development, test, ci | no | non-secret | `300000` | scripts, workflow | Secondary timeout for the credential-free Terraform staging plan. |
| `INFRA_SECURITY_TIMEOUT_MS` | internal | development, test, ci | no | non-secret | `300000` | scripts, workflow | Secondary timeout for infrastructure security scanning. |
| `INFRA_STEP_TIMEOUT_MS` | internal | development, test, ci | no | non-secret | `300000` | scripts, workflow | Default secondary timeout for supervised infrastructure steps. |
| `MAIL_REUSE_CONFIG_BUILD` | internal | test, ci | no | non-secret | `false` | scripts | Reuses compiled configuration during SMTP verification. |
| `MIGRATION_REUSE_DEMO_VERIFICATION` | internal | test, ci | no | non-secret | `false` | scripts | Delegates demo verification to its canonical pipeline task. |
| `MIGRATION_REUSE_PRISMA_CLIENT` | internal | test, ci | no | non-secret | `false` | scripts | Reuses the Prisma Client during isolated migration replay. |
| `NG_CLI_ANALYTICS` | internal | development, test, ci | no | non-secret | `false` | scripts | Disables Angular CLI analytics in local commands. |
| `PATH` | internal | production, ci | no | non-secret | none | docker | Container executable search path. |
| `PNPM_HOME` | internal | production, ci | no | non-secret | `/pnpm` | docker | pnpm installation path in the API build image. |
| `PRODUCTION_PAYMENT_GATEWAY_VALIDATED` | ci | ci | no | non-secret | `false` | scripts | External evidence flag confirming the production payment gateway. |
| `QUALITY_RUN_ID` | internal | development, test, ci | no | non-secret | none | scripts | Ephemeral identifier used to prove ownership of local services started by a quality run. |
| `QUALITY_SERVICES_STATE_PATH` | internal | development, test, ci | no | non-secret | `artifacts/quality-services-state.json` | scripts | Ephemeral state file used to remove only Docker containers owned by a quality run. |
| `REAL_WHATSAPP_VALIDATED` | ci | ci | no | non-secret | `false` | scripts | External evidence flag confirming real WhatsApp delivery. |
