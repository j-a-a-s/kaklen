# Kaklen

Foundation monorepo para Kaklen con API NestJS, web Angular, Prisma y PostgreSQL.

## Primer inicio

```bash
git clone git@github.com:j-a-a-s/kaklen.git
cd kaklen
cp .env.example .env
pnpm install
pnpm run setup
pnpm dev
```

`pnpm run setup` levanta PostgreSQL con Docker Compose, verifica `DATABASE_URL`, repara `.env` si detecta credenciales antiguas en el contenedor local, genera Prisma Client y ejecuta migraciones.

Comandos utiles:

- `pnpm run doctor`: diagnostica Node, pnpm, Docker, PostgreSQL, `DATABASE_URL`, Prisma y variables criticas.
- `node scripts/check-db.mjs`: prueba solo la conexion PostgreSQL.
- `pnpm verify`: ejecuta doctor, lint, test y build.

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

El setup inspecciona el contenedor local de PostgreSQL y actualiza `DATABASE_URL` en `.env` cuando puede confirmar las credenciales reales.

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
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `PATCH /api/auth/me/preferences`

`/api/auth/refresh` y `/api/auth/logout` validan el header `Origin` contra
`AUTH_ALLOWED_ORIGINS`. Para desarrollo local:

```bash
AUTH_ALLOWED_ORIGINS="http://localhost:4200"
COOKIE_SECURE=false
```

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
