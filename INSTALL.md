# Instalacion

## Requisitos

- Node.js 22 LTS o superior.
- pnpm 9 o superior.
- Docker y Docker Compose.

## Pasos

1. Instalar dependencias:

```bash
pnpm install
```

2. Crear archivo de entorno:

```bash
cp .env.example .env
```

Para autenticacion local, ajusta estos valores en `.env` antes de exponer el servicio:

```bash
JWT_ACCESS_SECRET="usa-un-secreto-largo-y-unico"
JWT_REFRESH_SECRET="usa-otro-secreto-largo-y-unico"
AUTH_ALLOWED_ORIGINS="http://localhost:4200"
COOKIE_SECURE=false
ORGANIZATION_INVITATION_EXPIRES_SECONDS=259200
APP_WEB_URL=http://localhost:4200
```

3. Levantar PostgreSQL:

```bash
docker compose up -d
```

Si ya tienes otro PostgreSQL usando `5432`, usa un puerto alternativo:

```bash
POSTGRES_PORT=55432 docker compose up -d
```

4. Generar cliente Prisma:

```bash
pnpm prisma:generate
```

5. Ejecutar migracion inicial:

```bash
pnpm prisma:migrate
```

Si usaste un puerto alternativo para Docker, ejecuta:

```bash
POSTGRES_PORT=55432 pnpm prisma:migrate
```

6. Levantar desarrollo:

```bash
pnpm dev
```

Si usaste un puerto alternativo para Docker, ejecuta:

```bash
POSTGRES_PORT=55432 pnpm dev
```

## Validacion

- API: http://localhost:3000/api/health
- Swagger: http://localhost:3000/docs
- Web: http://localhost:4200
- Auth: http://localhost:3000/api/auth/login
- Organizaciones: http://localhost:3000/api/organizations
