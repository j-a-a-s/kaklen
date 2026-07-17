# Instalacion

1. Clonar el repositorio:

```bash
git clone git@github.com:j-a-a-s/kaklen.git
cd kaklen
```

2. Crear el archivo de entorno:

```bash
cp .env.example .env
```

3. Instalar dependencias:

```bash
pnpm install
```

4. Preparar PostgreSQL y Prisma:

```bash
pnpm run setup
```

5. Levantar desarrollo:

```bash
pnpm dev:fresh
```

Para validar el MVP completo con API, PostgreSQL y los tres idiomas reales con compilaciones separadas:

```bash
pnpm dev:full:i18n
```

Para probar solo el frontend localizado:

```bash
pnpm dev:i18n
```

Abre `http://localhost:4200/es/login`, `http://localhost:4200/en/login` o `http://localhost:4200/pt-BR/login`.

No uses solo `pnpm dev:i18n` para pruebas de autenticación o CRUD, porque ese comando puede estar limitado al frontend localizado y no garantiza que la API NestJS esté disponible.

## Correo de autenticacion local

`pnpm dev:full:i18n` levanta tambien Mailpit. Registra una cuenta nueva o solicita la recuperacion desde Login, abre `http://localhost:8025` y sigue el enlace localizado. Una cuenta nueva no inicia sesion hasta confirmar su correo y luego debe ingresar manualmente.

Comprueba la conexion antes del recorrido:

```bash
pnpm mail:verify
```

La API ejecutada directamente en macOS usa `MAIL_HOST=localhost`. Una API ejecutada dentro de Docker debe usar el nombre del servicio: `MAIL_HOST=mailpit`.

Los valores de `.env.example` usan SMTP local sin autenticacion. En staging y produccion configura `APP_PUBLIC_URL`, `MAIL_FROM`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER` y `MAIL_PASSWORD` con el proveedor real. Nunca uses credenciales de produccion en `.env` versionado.

## Nota sobre pnpm setup

`pnpm setup` es un comando reservado de pnpm para configurar el gestor de paquetes en el sistema. El script de Kaklen debe ejecutarse como `pnpm run setup`.

## Cache local

Uso diario recomendado:

```bash
pnpm dev:fresh
```

Si sospecha cache:

```bash
pnpm clean:dev
pnpm dev:fresh
```

`pnpm clean:dev` no elimina `.env`, `node_modules`, datos de PostgreSQL ni volumenes Docker.

## Idiomas

Kaklen usa `@angular/localize` con builds separados. `pnpm dev` sirve el idioma base para iterar rapido; `pnpm dev:i18n` sirve los prefijos `/es`, `/en` y `/pt-BR` con fallback SPA por idioma.

## Validacion pre-tag

Para auditar el estado local antes de un primer tag:

```bash
pnpm release:check
```

Para auditar el criterio estricto 10/10:

```bash
pnpm release:check:strict
```

Este comando debe bloquear hasta que la cobertura cumpla los umbrales y AWS staging real este validado.

Para revisar solo base de datos:

```bash
pnpm db:validate
```

Para comprobar todo el historial en un schema temporal vacío sin modificar datos locales:

```bash
pnpm db:verify:migrations
```

Para recrear la base local de desarrollo con seed demo:

```bash
pnpm db:reset:dev -- --confirm reset-dev
```
