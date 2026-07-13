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
