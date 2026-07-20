# Entorno local

## Preparación

Parte de `.env.example` y conserva `.env` fuera de Git:

```bash
cp .env.example .env
pnpm install
pnpm run setup
```

`.env.example` es el bootstrap local mínimo generado desde el
[manifiesto ambiental](../configuration/environment-variables.json). El contrato
completo para despliegues está en `.env.production.example`; no copies valores
locales conocidos a producción.

El setup comprueba Docker, compara `DATABASE_URL` con el contenedor PostgreSQL
activo, valida autenticación y base, genera Prisma Client, aplica migraciones y
verifica tablas. Nunca corrige `.env` sin confirmación.

## Servicios

| Servicio | Puerto local | Propósito |
| --- | ---: | --- |
| Angular | `4200` | Interfaz web. |
| NestJS | `3000` | API y Swagger. |
| PostgreSQL | `5432` | Persistencia principal. |
| Redis | `6379` | Rate limiting, colas y estado efímero. |
| Mailpit SMTP | `1025` | Captura de correo local. |
| Mailpit Web | `8025` | Inspección de correo local. |

Docker Compose usa `kaklen`, `kaklen_dev_password` y `kaklen_dev` únicamente
como credenciales conocidas de desarrollo.

## Inicio diario

```bash
pnpm start
```

Para verificar traducciones compiladas sin API:

```bash
pnpm start --mode=i18n
```

Para autenticación, CRUD, correo y E2E manual con `es`, `en` y `pt-BR`:

```bash
pnpm start --mode=full
```

Las rutas localizadas son:

- `http://localhost:4200/es/login`
- `http://localhost:4200/en/login`
- `http://localhost:4200/pt-BR/login`

`dev:i18n` solo sirve el frontend; usa el modo `full` cuando el recorrido
necesite la API.

## Base de datos

```bash
pnpm db:validate
pnpm db:verify:migrations
pnpm db:seed
```

El reset es destructivo y está restringido a desarrollo local:

```bash
pnpm db:reset:dev -- --confirm reset-dev
```

Nunca borres un volumen Docker sin confirmar que sus datos son prescindibles.

## Cachés regenerables

```bash
pnpm clean:dev
pnpm start
```

`clean:dev` conserva `.env`, `node_modules`, datos de PostgreSQL y volúmenes
Docker. No uses `git reset --hard` como mecanismo de limpieza.

La referencia generada de configuración está en
[Environment Variables](../configuration/ENVIRONMENT_VARIABLES.md). Para
comprobar que código, ejemplos y documentación siguen sincronizados, ejecuta
`pnpm env:verify`.
