# Architecture

Kaklen is a pnpm workspace managed by Turborepo. The foundation separates runtime applications from reusable packages.

## Workspace Layout

- `apps/api`: NestJS 11 API. It exposes `/api/health`, serves Swagger at `/docs` outside production, enables explicit Helmet/CORS policies, and uses Prisma for database access.
- `apps/web`: Angular 20 application served on port `4200` in development.
- `apps/marketing`: Next.js 15 corporate/marketing site for Kaklen (kaklen.cl), served on port `4300` in development. It submits leads to `POST /api/leads` on `apps/api`; it does not access PostgreSQL, WhatsApp, or email directly.
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

## Assisted Operations

`AssistantModule` is an organization-scoped read model over existing business records. `UserActivationService` derives seven activation signals without persisting duplicate progress. `AssistantService` returns dashboard priorities, recent activity, global search, and client timelines through guarded routes under `/api/organizations/:organizationId/assistant`.

Global search uses parameterized PostgreSQL queries with the tenant identifier in every statement. The `20260715220000_add_unaccent_search` migration enables `unaccent` for case- and accent-insensitive matching. Existing tenant-leading indexes on clients, catalog items, quotations, and events remain the first filtering boundary; results are limited per category and mapped to minimal presentation contracts. Activity reuses `OrganizationAuditLog` and resolves referenced resources in batches instead of introducing a second event log.

Localized web builds:

```bash
pnpm --filter @kaklen/web build:es
pnpm --filter @kaklen/web build:en
pnpm --filter @kaklen/web build:pt-BR
```

## Development Commands

```bash
pnpm start
pnpm check
pnpm quality:gate
pnpm release:check:strict
```

`pnpm start` delegates to the existing `dev:fresh`, `dev:i18n`, or
`dev:full:i18n` implementation according to its mode. The complete contract is
documented in [Development Commands](development/COMMANDS.md), and local port
configuration lives in [Local Environment](development/LOCAL_ENVIRONMENT.md).

## HTTP Module Boundaries

Authentication owns registration, verification, login, token rotation, logout,
password recovery, profile reads, and locale preferences under `/api/auth`.
Its public routes are:

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

Organizations owns tenant lifecycle, membership, invitations, and permission
resolution:

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

The organization creator becomes `OWNER`. Invitations expire after the
configured `ORGANIZATION_INVITATION_EXPIRES_SECONDS` value, which defaults to
72 hours locally.

## Marketing Leads

`POST /api/leads` is a public, rate-limited endpoint (`ThrottlerGuard`, 5 requests/minute) that
`apps/marketing` submits to. It persists a `Lead` and an auditable `LeadEvent` trail, normalizes the
phone number to E.164 via `@kaklen/shared` (`normalizeInternationalPhone`, backed by
`@kokecore/validation`), notifies the internal team through the existing `MailService`, and — only if
`whatsappConsent` is true — sends a welcome message through the same `WhatsAppProvider` abstraction
used by the quotation flow. Until a real WhatsApp Business Cloud API adapter is configured
(`WHATSAPP_MODE=provider`), it records a pending manual follow-up and never reports an automatic
delivery, matching the existing behavior for quotation notifications.

## Build Strategy

Turborepo builds packages before applications. The Angular application uses the Angular compiler for the foundation build, while `ng serve` remains the development server. The API build uses TypeScript directly so output is explicit and predictable.
