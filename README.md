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
