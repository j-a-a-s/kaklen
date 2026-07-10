# Architecture

Kaklen is a pnpm workspace managed by Turborepo. The foundation separates runtime applications from reusable packages.

## Workspace Layout

- `apps/api`: NestJS 11 API. It exposes `/api/health`, serves Swagger at `/docs`, enables Helmet, and uses Prisma for database access.
- `apps/web`: Angular 20 application served on port `4200` in development.
- `packages/shared`: Shared TypeScript contracts and constants used by apps.
- `packages/config`: Configuration helpers and runtime defaults.
- `prisma`: Prisma schema and migrations for PostgreSQL.

## Runtime Flow

The web app calls the API health endpoint at `http://localhost:3000/api/health`. The API connects to PostgreSQL through Prisma using `DATABASE_URL`, or the local Docker defaults when the variable is not set.

```text
Angular Web -> NestJS API -> Prisma Client -> PostgreSQL 16
```

## Development Commands

```bash
pnpm install
docker compose up -d
pnpm prisma:generate
pnpm prisma:migrate
pnpm dev
```

If port `5432` is already in use, set `POSTGRES_PORT` consistently:

```bash
POSTGRES_PORT=55432 docker compose up -d
POSTGRES_PORT=55432 pnpm prisma:migrate
POSTGRES_PORT=55432 pnpm dev
```

## Build Strategy

Turborepo builds packages before applications. The Angular application uses the Angular compiler for the foundation build, while `ng serve` remains the development server. The API build uses TypeScript directly so output is explicit and predictable.
