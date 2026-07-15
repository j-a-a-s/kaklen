# Kaklen First Tag Audit

## 1. Resumen ejecutivo

Kaklen contiene las vertical slices principales del pre-MVP: Auth, Organizations/RBAC, CRM Clients, Catalog, Quotations, Events, i18n, Health, AWS runtime foundation y Developer Experience local. La auditoria corrigio bloqueantes de release gate: runtime config generado versionado, falta de comandos DB seguros, falta de gate `release:check`, CI incompleto frente al primer tag y health sin estado de base de datos.

## 2. Estado general

READY WITH WARNINGS for a local alpha tag.

El estado es apto para preparar `v0.1.0-alpha.1` si la validacion final del entorno local y CI pasa. No se recomienda `v1.0.0`.

Estado 10/10 estricto: RELEASE BLOCKED.

Motivo: cobertura por debajo de umbrales estrictos y AWS staging real no validado.

## 3. Bloqueantes encontrados

- Runtime config generado estaba versionado en `apps/web/public/runtime-config.js` y `apps/web/public/runtime-config.json`.
- No existian `pnpm db:reset:dev`, `pnpm db:validate` ni `pnpm release:check`.
- CI no ejecutaba secret scan, DB validate, verify API build, verify i18n server ni E2E.
- Health no exponia estado de dependencia de base de datos.

## 4. Correcciones realizadas

- Runtime config queda generado por scripts y excluido por `.gitignore`.
- `@kaklen/web dev` genera runtime config antes de `ng serve`.
- Health incluye `checks.database`.
- Se agregaron `security:scan`, `db:validate`, `db:reset:dev` y `release:check`.
- CI ahora valida secret scan, dependency audit, DB, API build, i18n server y E2E.
- Se agrego checklist verificable para primer tag.

## 5. Riesgos residuales

- `pnpm dependency:audit` depende de red en CI y puede detectar vulnerabilidades nuevas fuera del lockfile actual.
- La validacion visual completa de UX/accesibilidad sigue requiriendo revision manual por viewport y teclado.
- AWS staging aun no esta desplegado; la preparacion existe como documentacion e infraestructura base.
- Las migraciones historicas contienen varios nombres `init`; no bloquean si `prisma migrate status` y base limpia pasan, pero conviene consolidar naming despues del primer tag alpha.
- `wallet.*` aparece en matriz de permisos sin modulo de negocio activo; no bloquea mientras ningun endpoint lo use.
- Cobertura medida del API no alcanza el objetivo estricto 90/85/90/90.
- En la sesion local de Codex/Turbo se observaron warnings de entorno `NO_COLOR` junto con `FORCE_COLOR`; no son warnings de compilacion de Kaklen, pero deben revisarse si aparecen en CI.

## 6. Deuda tecnica

- Ampliar tests multi-tenant de controller/E2E para IDs adivinados en todos los modulos.
- Agregar pruebas visuales de idioma para detectar texto español visible en `/en` y `/pt-BR`.
- Agregar politica de cache CloudFront probada en staging real.
- Separar auditoria de accesibilidad con tooling especifico cuando se defina el design system.

## 7. Cobertura de tests

- Unit/service tests: Auth, Clients, Catalog, Quotations, Events, Health, runtime config, logging, RUT, storage key, permissions.
- Script tests: DB diagnostics, i18n server, full local, versioning, session cleanup, API build, release readiness.
- E2E Playwright: registro, auth, organization, clients, catalog, quotations, events, logout y localized routes.

## 8. Matriz funcional

| Modulo | Estado | Evidencia |
| --- | --- | --- |
| Auth | READY | Unit, E2E auth, refresh, logout |
| Organizations | READY WITH WARNINGS | RBAC guard y E2E basico; faltan mas casos multi-tenant cruzados |
| CRM / Clients | READY | Service tests y E2E CRUD/RUT |
| Catalog | READY | Service tests y E2E producto/servicio |
| Quotations | READY | Service tests y E2E estado/version |
| Events | READY | Service tests y E2E evento/tareas/participantes |
| Notifications | READY WITH WARNINGS | Templates por idioma; sin envio real aun |
| i18n | READY | Builds es/en/pt-BR y verify server |
| Health | READY | health/live/ready con metadata y database check |
| AWS runtime | READY WITH WARNINGS | Dockerfile, docs e infra base; falta staging real |
| DX | READY | doctor, setup, dev full, verify scripts y release check |

## 9. Matriz de seguridad

| Area | Estado | Nota |
| --- | --- | --- |
| Secrets | READY | `security:scan` sobre archivos versionados |
| Auth cookies | READY | Refresh HttpOnly; CORS con credentials sin wildcard |
| Rate limit | READY | Throttler en endpoints auth sensibles |
| RBAC backend | READY | Guard por membership y permisos |
| Multitenancy | READY WITH WARNINGS | OrganizationAccessGuard evita acceso cruzado; ampliar E2E negativo |
| Input validation | READY | DTOs con class-validator |
| RUT CL | READY | Validador modulo 11 y tests |
| Error handling | READY | Filtro tipado de errores |

## 10. Matriz i18n

| Locale | Estado |
| --- | --- |
| es | READY |
| en | READY |
| pt-BR | READY |

Validaciones esperadas: build por locale, base href correcto, MIME correcto para JS/CSS, runtime config disponible y selector unico.

## 11. Matriz AWS

| Area | Estado |
| --- | --- |
| ECS API | PREPARED |
| RDS PostgreSQL | PREPARED |
| S3 storage | PREPARED |
| CloudFront localized web | PREPARED |
| Secrets Manager | PENDING STAGING |
| Logs/health checks | PREPARED |
| Migrations deploy | PREPARED |
| Cookies secure/domain | PENDING STAGING |

## 12. Evidencia de comandos

```text
pnpm run doctor                         PASS
pnpm run setup                          PASS
pnpm db:validate                        PASS
pnpm db:seed                            PASS
pnpm lint                               PASS
pnpm test                               PASS: 55 script tests, 13 API suites, 63 API tests
pnpm test:coverage                      BLOCKED: statements 59.81%, branches 32.97%, functions 29.42%, lines 58.58%
pnpm build                              PASS
pnpm verify:api-build                   PASS
pnpm verify:api-start                   PASS
pnpm verify:i18n-server                 PASS
pnpm verify:full-local                  PASS
pnpm accessibility:test                 PASS
pnpm e2e                                PASS: 19 Playwright tests
pnpm release:check                      PASS: RELEASE READY
pnpm release:check:strict               BLOCKED: coverage and AWS staging
pnpm --filter @kaklen/api clean         PASS
pnpm prisma:generate                    PASS
pnpm --filter @kaklen/api build         PASS
pnpm --filter @kaklen/api start         PASS
```

Validacion manual HTTP:

```text
GET  http://localhost:3000/api/health        200 application/json; checks.database=unknown
GET  http://localhost:3000/api/health/live   200 application/json
GET  http://localhost:3000/api/health/ready  200 application/json; checks.database=ok
HEAD http://localhost:3000/docs              200 text/html
GET  http://localhost:4200/es/login          200 text/html
GET  http://localhost:4200/en/login          200 text/html
GET  http://localhost:4200/pt-BR/login       200 text/html
OPTIONS /api/auth/login desde localhost:4200 204 con credentials=true
```

## 13. Recomendacion de version del primer tag

Recomendado: `v0.1.0-alpha.1`.

Justificacion: la aplicacion ya cubre vertical slices del pre-MVP y gate local automatizado, pero staging AWS, revision visual amplia y pruebas negativas multi-tenant extendidas aun son warnings reales.

## 14. Pendientes no bloqueantes para MVP AWS

- Ejecutar staging real en AWS con RDS, ECS, S3, CloudFront y dominio.
- Rotar secretos si alguna credencial real aparece fuera de `.env.example`.
- Agregar monitoreo externo de health/ready.
- Validar cookies `Secure` y dominios reales.
- Confirmar estrategia de backup/restore RDS.

## 15. Scorecard 10/10

Ver [TECHNICAL_SCORECARD.md](./TECHNICAL_SCORECARD.md).
