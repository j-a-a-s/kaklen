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
