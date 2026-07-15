# Architecture Review

## Scope

Revision pre-tag de Kaklen sobre el monorepo actual:

- `apps/api`: NestJS API, Prisma, Auth, Organizations, Clients, Catalog, Quotations, Events, Health, Storage y Notifications templates.
- `apps/web`: Angular localizado para `es`, `en` y `pt-BR`.
- `packages/config`: lectura tipada de configuracion compartida.
- `packages/shared`: contratos compartidos entre API y web.
- `prisma`: schema y migraciones.
- `scripts`: DX, release gates, verificadores y servidores locales.

## Module Map

| Area | Modulos | Responsabilidad |
| --- | --- | --- |
| Auth | `auth`, JWT guard, refresh tokens | Identidad, sesion, cookies y preferencias de usuario |
| Organizations/RBAC | `organizations`, guards, permissions | Tenant activo, membresias, roles y autorizacion |
| CRM | `clients` | Clientes, RUT, interacciones y archivo logico |
| Catalog | `catalog` | Productos y servicios por organizacion |
| Quotations | `quotations` | Cotizaciones, items, estados, versionado y PDF |
| Events | `events` | Eventos, tareas, participantes, recursos y calendario |
| Health | `health` | `health/live/ready`, metadata y DB readiness |
| i18n | Angular localize, XLIFF, locale server | Rutas y builds localizados |
| DX | `scripts/*` | Setup local, DB diagnostics, release checks y build verification |
| AWS | `docs/aws`, Dockerfile, runtime config | Preparacion de runtime y despliegue staging |

## Dependency Direction

```text
apps/web -> packages/shared
apps/web -> runtime-config public
apps/api -> packages/config
apps/api -> packages/shared
apps/api -> Prisma Client
scripts -> repo files, Docker, Prisma, Playwright
packages/shared -> no app dependency
packages/config -> no app dependency
```

Los packages compartidos no dependen de las aplicaciones. Los modulos de negocio de API dependen de `PrismaService`, DTOs locales, guards compartidos y contratos cuando corresponde.

## Automated Evidence

- `pnpm architecture:check`: detecta ciclos en imports relativos y workspace imports.
- `pnpm quality:scan`: detecta marcadores de deuda tecnica y tipos amplios explicitos.
- `pnpm verify:api-build`: comprueba `dist/main.js`, `dist/prisma/prisma.service.js` y require relativos.
- `pnpm release:check`: valida build, API start smoke, DB, i18n server, full local y E2E.

## Decisions

- Runtime config no se versiona: se genera en `apps/web/public` antes de builds/dev y queda ignorado por Git.
- El modo dev de API usa `nest start --watch` despues de limpiar `dist`; `start` usa `dist/main.js` solo tras build verificado.
- `release:check:strict` no declara 10/10 sin staging AWS real ni cobertura suficiente.
- i18n usa build-time localization y servidor local que sirve cada locale desde su `browser` root real.

## Risks

- La separacion de dominio e infraestructura es suficiente para pre-MVP, pero los servicios Nest aun mezclan reglas de dominio y persistencia Prisma. No bloquea el tag alpha, pero limita un 10/10 arquitectonico de largo plazo.
- La cobertura de tests no alcanza los umbrales estrictos solicitados.
- Staging AWS no fue validado realmente en este entorno.

## Status

Arquitectura local: lista para tag alpha con warnings.  
Arquitectura 10/10 global: bloqueada hasta cerrar cobertura, staging y validaciones externas.
