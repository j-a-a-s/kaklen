# Kaklen

[![Kaklen Quality Gate](https://github.com/j-a-a-s/kaklen/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/j-a-a-s/kaklen/actions/workflows/ci.yml)

Kaklen es un monorepo para operaciones comerciales y de eventos, construido con
Angular 20, NestJS 11, Prisma, PostgreSQL y Turborepo.

## Requisitos

- Node.js 22, 23 o 24.
- pnpm 9.15.4 o una versión compatible de la serie 9.
- Docker con Docker Compose v2.
- Git.

## Inicio rápido

```bash
git clone --recurse-submodules git@github.com:j-a-a-s/kaklen.git
cd kaklen
cp .env.example .env
pnpm install
pnpm run setup
pnpm start
```

La guía para preparar el entorno y realizar el primer cambio está en
[Start Here](docs/START_HERE.md).

## Cuatro comandos

| Comando | Propósito |
| --- | --- |
| `pnpm start` | Iniciar el entorno de desarrollo; admite `--mode=i18n` y `--mode=full`. |
| `pnpm check` | Ejecutar controles rápidos sin servicios externos. |
| `pnpm quality:gate` | Validar la integración local completa. |
| `pnpm release:check:strict` | Evaluar todos los requisitos de una entrega estricta. |

Los comandos anteriores son la interfaz pública del repositorio. Los aliases
históricos siguen disponibles y están documentados en
[Commands](docs/development/COMMANDS.md).

## Arquitectura resumida

```text
Angular Web -> NestJS API -> Prisma Client -> PostgreSQL 16
                         -> Redis / BullMQ
                         -> SMTP / Mailpit
```

El workspace separa aplicaciones en `apps/`, contratos y configuración
reutilizable en `packages/`, y persistencia en `prisma/`. Consulta la
[arquitectura completa](docs/ARCHITECTURE.md).

## Quality Gate

`pnpm quality:gate` resuelve un grafo canónico, ejecuta cada control una sola
vez, falla rápido y solo termina correctamente cuando imprime
`QUALITY GATE PASSED`. CI ejecuta el mismo grafo con el perfil preparado para
GitHub Actions. Los perfiles y artefactos están descritos en
[Quality Pipeline](docs/testing/QUALITY_PIPELINE.md).

<!-- scorecard-summary:start -->
| Metric | Current value |
| --- | ---: |
| Statements | 96.6% |
| Branches | 85.7% |
| Functions | 94.7% |
| Lines | 97.0% |
| Local Quality | 10/10 |
| Production Readiness local | 4/4 |
<!-- scorecard-summary:end -->

Consulta la evidencia y los criterios en el
[Technical Scorecard](docs/release/TECHNICAL_SCORECARD.md).

## Documentación

- [Índice central](docs/README.md)
- [Instalación y primer cambio](docs/START_HERE.md)
- [Entorno local](docs/development/LOCAL_ENVIRONMENT.md)
- [Solución de problemas](docs/development/TROUBLESHOOTING.md)
- [Variables de entorno](docs/configuration/ENVIRONMENT_VARIABLES.md)
- [Gobernanza del proyecto](docs/governance/PROJECT_GOVERNANCE.md)
- [Propiedad y contribuciones](docs/governance/OWNERSHIP_AND_CONTRIBUTIONS.md)
- [Gobierno de dependencias](docs/governance/DEPENDENCY_UPDATES.md)
- [Contribución](CONTRIBUTING.md)

## Credenciales demo locales

Los seeds crean cuentas y datos de demostración exclusivamente para desarrollo
local. Sus credenciales son públicas, no deben reutilizarse fuera de un entorno
local y nunca deben convertirse en secretos reales. Consulta
[Demo Accounts](docs/testing/DEMO_ACCOUNTS.md).

## Licencia

Kaklen es software propietario. Consulta [LICENSE](LICENSE).
