# Start Here

Esta guía lleva un clon nuevo hasta el primer cambio validado. Los comandos se
ejecutan desde la raíz del repositorio.

## Requisitos

- Node.js `>=22 <25`.
- pnpm `>=9.15.4 <10`.
- Docker con Docker Compose v2 y el daemon activo.
- Git.

## Instalación

```bash
git clone --recurse-submodules git@github.com:j-a-a-s/kaklen.git
cd kaklen
cp .env.example .env
pnpm install
pnpm run setup
pnpm start
```

Si el repositorio ya existía antes de incorporar KOKE CORE, ejecuta una vez
`git submodule update --init --recursive`. El gitlink versionado fija el commit
permitido; una actualización del submódulo requiere su propia revisión.

`pnpm run setup` valida una conexión real a PostgreSQL, genera Prisma Client,
aplica migraciones y verifica las tablas. No modifica `.env` automáticamente.

Al finalizar, abre:

- Web: `http://localhost:4200`
- API health: `http://localhost:3000/api/health`
- Swagger: `http://localhost:3000/docs`
- Mailpit: `http://localhost:8025`

## Mapa de trabajo

```text
Desarrollar → pnpm start
Validar rápido → pnpm check
Validar integración → pnpm quality:gate
Preparar release → pnpm release:check:strict
```

## Primer cambio

1. Crea una rama desde `main` y mantén el cambio acotado.
2. Sigue los patrones existentes en `apps/`, `packages/` y `prisma/`.
3. Ejecuta `pnpm check` mientras iteras.
4. Ejecuta `pnpm quality:gate` antes de solicitar revisión.
5. Usa un mensaje [Conventional Commit](../CONTRIBUTING.md#commit-style).

Para trabajar con los tres builds de idioma y la API usa
`pnpm start --mode=full`. La referencia completa está en
[Commands](development/COMMANDS.md).

## Datos demo

`pnpm db:seed` crea `admin.demo@kaklen.local` con contraseña
`KaklenDemo123!`. Es una credencial pública y local; nunca debe utilizarse en
staging o producción. El dataset ampliado se documenta en
[Demo Accounts](testing/DEMO_ACCOUNTS.md).
