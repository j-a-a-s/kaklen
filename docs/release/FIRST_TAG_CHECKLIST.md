# Kaklen First Tag Checklist

Usar este checklist antes de crear el primer tag pre-MVP. No crear tag si algun punto automatizado falla o si aparece un bloqueante no documentado.

- [x] lint (`pnpm lint`)
- [x] unit tests (`pnpm test`)
- [x] integration tests (`pnpm test`, API e2e specs)
- [x] E2E (`pnpm e2e`)
- [x] API build (`pnpm --filter @kaklen/api build`)
- [x] API start (`pnpm verify:api-start`)
- [x] DB migrations (`pnpm db:validate`)
- [x] clean migration rebuild (`pnpm db:verify:migrations`)
- [x] seed (`pnpm db:seed`)
- [x] i18n es (`pnpm --filter @kaklen/web build:es`)
- [x] i18n en (`pnpm --filter @kaklen/web build:en`)
- [x] i18n pt-BR (`pnpm --filter @kaklen/web build:pt-BR`)
- [x] health (`/api/health`, `/api/health/live`, `/api/health/ready`)
- [x] auth (`pnpm test`, `pnpm e2e`)
- [x] multi-tenant (`OrganizationAccessGuard`, service tests, E2E core)
- [x] RBAC (`permissions.spec.ts`, guarded endpoints)
- [x] clients (`clients.service.spec.ts`, E2E core)
- [x] catalog (`catalog.service.spec.ts`, E2E core)
- [x] quotations (`quotations.service.spec.ts`, E2E core)
- [x] events (`events.service.spec.ts`, E2E core)
- [x] logout (`session-cleanup.test.mjs`, E2E core)
- [x] version (`versioning.test.mjs`)
- [x] cache (`verify:i18n-server`, runtime config generation)
- [x] Docker (`pnpm run doctor`, `docker compose` checks)
- [x] security scan (`pnpm security:scan`)
- [x] no secrets (`pnpm security:scan`)
- [x] docs (`docs/release`, `docs/security`, `docs/aws`, `docs/operations`)
- [x] AWS staging checklist (`docs/aws/STAGING_VALIDATION.md`)

Comando automatizado principal:

```bash
pnpm release:check
```

Gate estricto 10/10:

```bash
pnpm release:check:strict
```

Este comando debe devolver `RELEASE BLOCKED` mientras no exista staging AWS real validado y mientras la cobertura no cumpla los umbrales estrictos.

Validacion manual minima:

```bash
pnpm --filter @kaklen/api start
curl -I http://localhost:3000/api/health
curl -I http://localhost:3000/api/health/live
curl -I http://localhost:3000/api/health/ready
curl -I http://localhost:3000/docs
pnpm dev:full:i18n
curl -I http://localhost:4200/es/login
curl -I http://localhost:4200/en/login
curl -I http://localhost:4200/pt-BR/login
```
