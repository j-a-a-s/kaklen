# Solución de problemas

## Diagnóstico inicial

Ejecuta siempre primero:

```bash
pnpm doctor
```

El diagnóstico muestra versiones, Docker CLI y daemon, Compose, variables
críticas, host y puerto PostgreSQL, autenticación, base, Prisma y migraciones.
No imprime contraseñas.

## Docker no está disponible

Inicia Docker Desktop o el daemon de tu sistema y vuelve a ejecutar:

```bash
pnpm run setup
```

## Prisma P1000

`P1000` indica credenciales inválidas. `DATABASE_URL` no coincide con el
servidor o con el contenedor PostgreSQL activo.

```bash
pnpm doctor
pnpm run setup
```

El setup compara usuario, base, host y puerto sin revelar la contraseña. No
reescribe `.env` automáticamente.

## Prisma P1001

`P1001` indica que PostgreSQL no está disponible en el host o puerto configurado.

```bash
docker compose up -d postgres
pnpm doctor
```

## Prisma P1003

`P1003` indica que la base nombrada en `DATABASE_URL` no existe.

```bash
pnpm run setup
```

Cuando las credenciales permiten usar la base administrativa, el setup crea la
base y vuelve a comprobar la conexión real.

## Puerto ocupado

Detén el proceso que ya usa `3000`, `4200`, `5432`, `6379`, `1025` u `8025`.
Si PostgreSQL debe usar otro puerto, actualiza juntos `POSTGRES_PORT` y
`DATABASE_URL`; no cambies solo uno.

## Frontend localizado en blanco

Limpia outputs, reconstruye y valida el servidor por idioma:

```bash
pnpm clean:dev
pnpm verify:i18n-server
pnpm start --mode=i18n
```

Para login o llamadas CRUD usa `pnpm start --mode=full`, porque el modo i18n no
garantiza una API activa.

## API o login no disponibles

Comprueba primero:

```bash
curl http://localhost:3000/api/health/live
curl http://localhost:3000/api/health/ready
```

Una respuesta `401` de login confirma conectividad con credenciales inválidas;
una conexión rechazada requiere iniciar la API. Para verificar todo el entorno:

```bash
pnpm verify:full-local
```

## Build o navegador desactualizado

```bash
pnpm clean:dev
pnpm start
```

La información de versión del login se mantiene oculta y puede alternarse con
`Cmd/Ctrl + K`, soltar y luego `O`. Compara su commit con `GET /api/health`.
