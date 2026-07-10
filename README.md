# Kaklen

Foundation monorepo para Kaklen con API NestJS, web Angular, Prisma y PostgreSQL.

## Auth

La autenticacion expone:

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

`/api/auth/refresh` y `/api/auth/logout` validan el header `Origin` contra
`AUTH_ALLOWED_ORIGINS`. Para desarrollo local:

```bash
AUTH_ALLOWED_ORIGINS="http://localhost:4200"
COOKIE_SECURE=false
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
