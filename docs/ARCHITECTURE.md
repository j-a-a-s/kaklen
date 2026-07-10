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

## Internationalization and Regional Settings

The Angular app supports `es`, `en`, and `pt-BR`; `es` is the default interface language. Visible text is marked with Angular i18n metadata and translated through XLIFF files in `apps/web/src/locale`.

Interface language preference is resolved in this order:

1. `User.locale`
2. `Organization.defaultLocale`
3. browser locale
4. `es`

The visible selector stores the selected interface language in `localStorage` as a visual preference. Authenticated users can persist the preference through `PATCH /api/auth/me/preferences`.

Regional configuration is intentionally separate from interface language. `Organization.country`, `Organization.currency`, `Organization.timezone`, `Organization.dateFormat`, and `Organization.numberFormat` drive operational formats such as money, dates, and numbers. Changing the interface language must not change persisted business formats. Runtime data such as enum values, permission keys, error codes, and technical identifiers remain untranslated.

Localized web builds:

```bash
pnpm --filter @kaklen/web build:es
pnpm --filter @kaklen/web build:en
pnpm --filter @kaklen/web build:pt-BR
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
