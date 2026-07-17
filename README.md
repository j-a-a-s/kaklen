# Kaklen

Foundation monorepo para Kaklen con API NestJS, web Angular, Prisma y PostgreSQL.

## Primer inicio

```bash
git clone git@github.com:j-a-a-s/kaklen.git
cd kaklen
cp .env.example .env
pnpm install
pnpm run setup
pnpm dev:fresh
```

`pnpm run setup` verifica `DATABASE_URL` contra PostgreSQL real, compara las credenciales con el contenedor activo cuando existe, levanta PostgreSQL con Docker Compose si no responde, genera Prisma Client y ejecuta migraciones. No modifica `.env` automaticamente.

Comandos utiles:

- `pnpm run doctor`: diagnostica Node, pnpm, Docker, PostgreSQL, `DATABASE_URL`, Prisma y variables criticas.
- `node scripts/check-db.mjs`: prueba solo la conexion PostgreSQL.
- `pnpm dev:fresh`: limpia artefactos regenerables, regenera runtime config, ejecuta Prisma generate y levanta desarrollo.
- `pnpm dev:i18n`: limpia artefactos, genera runtime config, construye y sirve solo los builds localizados en `/es`, `/en` y `/pt-BR`.
- `pnpm dev:full:i18n`: levanta PostgreSQL, servicios auxiliares, API NestJS y frontend localizado para validar el MVP completo.
- `pnpm verify:full-local`: valida health, frontend localizado, runtime config, CORS y conectividad del login.
- `pnpm e2e`: prepara API y frontend localizado, ejecuta Playwright y limpia todos los procesos que inició.
- `pnpm e2e:ui`: abre Playwright UI bajo el mismo ciclo controlado; `Ctrl+C` ejecuta cleanup.
- `pnpm clean:dev`: limpia caches locales sin borrar `.env`, `node_modules`, datos ni volumenes Docker.
- `pnpm verify`: ejecuta doctor, lint, test y build.

## Uso diario recomendado

Usa siempre:

```bash
pnpm dev:fresh
```

Para probar el cambio real de idioma con `@angular/localize`, usa:

```bash
pnpm dev:i18n
```

`pnpm dev` sirve el idioma base para desarrollo rapido. `pnpm dev:i18n` sirve `http://localhost:4200/es/login`, `http://localhost:4200/en/login` y `http://localhost:4200/pt-BR/login` desde compilaciones separadas.

Para validar autenticacion, CRUD, health checks y el recorrido completo del MVP con los tres idiomas, usa:

```bash
pnpm dev:full:i18n
```

No uses solo `pnpm dev:i18n` para pruebas de autenticacion o CRUD: ese comando esta limitado al frontend localizado y no garantiza que la API NestJS este levantada.

La informacion de version en login esta oculta por defecto y se revela solo con el atajo de diagnostico `Cmd/Ctrl + K`, soltar, luego `O`.

## E2E y Quality Gate

`pnpm e2e` es la única ruta oficial para Playwright. El runner comprueba puertos libres, espera health real de API y web, conserva el código de Playwright y considera `SIGTERM` esperado únicamente durante su propio cleanup. No reutiliza servidores iniciados manualmente.

```bash
pnpm e2e
pnpm quality:gate
```

El Quality Gate se detiene ante el primer control no exitoso y termina con `QUALITY GATE PASSED` solo cuando todos devuelven 0. La arquitectura, señales, códigos de salida y troubleshooting están documentados en [docs/testing/E2E_PROCESS_LIFECYCLE.md](docs/testing/E2E_PROCESS_LIFECYCLE.md).

Si sospechas cache del navegador o builds antiguos:

```bash
pnpm clean:dev
pnpm dev:fresh
```

No uses `git reset --hard` para limpiar cache local. Tampoco borres `node_modules` salvo que el problema sea de dependencias. Para comparar frontend y API, usa el panel oculto de version en login y `GET /api/health`; en desarrollo Kaklen avisa si los commits no coinciden.

## Solucion de problemas

Ejecuta primero:

```bash
pnpm run doctor
```

Si Docker esta instalado pero apagado, abre Docker Desktop y vuelve a ejecutar:

```bash
pnpm run setup
```

## Errores comunes

### P1000

Credenciales invalidas para PostgreSQL. Suele ocurrir cuando un contenedor antiguo fue creado con otra contraseña.

Solucion:

```bash
pnpm run setup
```

El setup inspecciona el contenedor local de PostgreSQL y avisa si `DATABASE_URL` no coincide con `POSTGRES_USER`, `POSTGRES_PASSWORD` o `POSTGRES_DB`. No muestra la password completa ni modifica `.env` automaticamente.

### P1001

El servidor PostgreSQL no esta disponible.

Solucion:

```bash
docker compose up -d postgres
pnpm run doctor
```

### P1003

La base de datos no existe.

Solucion:

```bash
pnpm run setup
```

El setup intentara crear la base indicada por `DATABASE_URL` cuando las credenciales permitan conectarse a la base administrativa `postgres`.

## Auth

La autenticacion expone:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/verify-email`
- `POST /api/auth/resend-verification-email`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me/preferences`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`

`/api/auth/refresh` y `/api/auth/logout` validan el header `Origin` contra
`AUTH_ALLOWED_ORIGINS`. Para desarrollo local:

```bash
AUTH_ALLOWED_ORIGINS="http://localhost:4200"
COOKIE_SECURE=false
```

### Confirmacion obligatoria de correo

El registro crea una cuenta `ACTIVE` pendiente con `emailVerifiedAt = null`, envia un enlace localizado y responde solo con un mensaje. No emite access token, refresh token ni cookie, y la interfaz permanece anonima. Login devuelve `403 EMAIL_NOT_VERIFIED` hasta que `POST /api/auth/verify-email` consume el enlace de un solo uso; el usuario inicia sesion manualmente despues.

El reenvio mediante `POST /api/auth/resend-verification-email` siempre entrega una respuesta publica generica, revoca enlaces anteriores y aplica limites por IP y correo normalizado. Si SMTP falla, la cuenta se conserva pendiente, el token fallido se revoca y el fallo queda en log y auditoria para permitir un reenvio posterior.

### Recuperacion de contraseña

El enlace `¿Olvidaste tu contraseña?` de Login inicia un flujo con respuesta publica generica, token aleatorio de un solo uso almacenado como SHA-256 y vencimiento configurable. Al completar el cambio se revocan todos los refresh tokens y se incrementa la version de sesion para invalidar access tokens anteriores.

Configuracion local:

```bash
APP_PUBLIC_URL=http://localhost:4200
EMAIL_VERIFICATION_EXPIRES_MINUTES=1440
PASSWORD_RESET_EXPIRES_MINUTES=30
MAIL_FROM="Kaklen <no-reply@kaklen.local>"
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_USER=
MAIL_PASSWORD=
MAIL_CONNECTION_TIMEOUT_MS=5000
MAIL_GREETING_TIMEOUT_MS=5000
MAIL_SOCKET_TIMEOUT_MS=10000
```

Verifica SMTP antes de probar el formulario:

```bash
pnpm mail:verify
```

Con `pnpm dev:full:i18n`, los correos quedan disponibles en Mailpit: `http://localhost:8025`. Un envio aceptado genera un log `[mail:sent]` con destinatario, locale y `messageId`; nunca contiene el token, la URL completa, la contraseña ni credenciales SMTP. Las especificaciones viven en [confirmacion de correo](docs/auth/EMAIL_VERIFICATION.md), [recuperacion de contraseña](docs/auth/PASSWORD_RECOVERY.md) y la [guia de correo local](docs/notifications/LOCAL_EMAIL_TESTING.md).

## Internacionalizacion y configuracion regional

La web soporta `es`, `en` y `pt-BR`, con `es` como idioma de interfaz predeterminado.
El selector visible guarda la preferencia en `localStorage` solo como preferencia visual y, cuando hay usuario autenticado, actualiza `PATCH /api/auth/me/preferences`.

Prioridad de locale:

1. `User.locale`
2. `Organization.defaultLocale`
3. locale del navegador
4. `es`

La configuracion regional de negocio es independiente del idioma de interfaz. `Organization.country`, `currency`, `timezone`, `dateFormat` y `numberFormat` controlan fechas, numeros y moneda.

Builds localizados:

```bash
pnpm --filter @kaklen/web build:es
pnpm --filter @kaklen/web build:en
pnpm --filter @kaklen/web build:pt-BR
```

## Organizaciones y RBAC

Endpoints principales:

- `POST /api/organizations`
- `GET /api/organizations`
- `GET /api/organizations/:organizationId`
- `PATCH /api/organizations/:organizationId`
- `GET /api/organizations/:organizationId/members`
- `PATCH /api/organizations/:organizationId/members/:membershipId`
- `DELETE /api/organizations/:organizationId/members/:membershipId`
- `POST /api/organizations/:organizationId/invitations`
- `GET /api/organizations/:organizationId/invitations`
- `DELETE /api/organizations/:organizationId/invitations/:invitationId`
- `POST /api/organization-invitations/accept`
- `GET /api/organizations/:organizationId/me/permissions`

El creador de una organización queda como `OWNER`. Las invitaciones expiran por defecto en 72 horas:

```bash
ORGANIZATION_INVITATION_EXPIRES_SECONDS=259200
APP_WEB_URL=http://localhost:4200
```

## Base de datos de desarrollo

Validar conexion, schema Prisma, migraciones y tablas accesibles:

```bash
pnpm db:validate
```

Reconstruir todas las migraciones en un schema temporal, comprobar drift, estructura crítica y dataset demo:

```bash
pnpm db:verify:migrations
```

Aplicar seed reproducible local:

```bash
pnpm db:seed
```

Credencial demo local creada por el seed:

```text
Email: admin.demo@kaklen.local
Password: KaklenDemo123!
```

Reset local destructivo, solo contra `localhost` y nunca en production:

```bash
pnpm db:reset:dev -- --confirm reset-dev
```

## Gate de primer tag

Antes de crear un tag estable ejecuta:

```bash
pnpm release:check
```

El comando termina con `RELEASE READY` solo si pasan secret scan, doctor, setup, validación de la base activa, reconstrucción limpia de migraciones, Prisma, API build, lint, tests, build, i18n, full local y E2E. El checklist manual vive en `docs/release/FIRST_TAG_CHECKLIST.md` y el informe de auditoria en `docs/release/FIRST_TAG_AUDIT.md`.

Para evaluar el criterio estricto 10/10:

```bash
pnpm release:check:strict
```

Este gate agrega arquitectura, quality scan, SAST local, SBOM, dependency audit, cobertura y accesibilidad. Debe bloquear con `RELEASE BLOCKED` mientras no se validen AWS staging real y los umbrales de cobertura descritos en `docs/release/TECHNICAL_SCORECARD.md`.
