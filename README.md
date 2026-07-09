# Kaklen

Foundation monorepo para Kaklen con Turborepo, pnpm, NestJS 11, Angular 20, Prisma, PostgreSQL 16, Docker Compose, Swagger y Helmet.

## Estructura

- `apps/api`: API NestJS con health check y Swagger.
- `apps/web`: aplicación Angular.
- `packages/shared`: contratos compartidos.
- `packages/config`: utilidades de configuración.
- `prisma/schema.prisma`: modelo inicial Prisma.

## Comandos principales

```bash
pnpm install
docker compose up -d
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

## URLs

- API health: http://localhost:3000/api/health
- Swagger: http://localhost:3000/docs
- Web: http://localhost:4200

Si el puerto local `5432` ya esta ocupado, puedes levantar PostgreSQL en otro puerto:

```bash
POSTGRES_PORT=55432 docker compose up -d
POSTGRES_PORT=55432 pnpm prisma:migrate
POSTGRES_PORT=55432 pnpm dev
```

## Build y test

```bash
pnpm build
pnpm test
```
