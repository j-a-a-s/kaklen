# Comandos de desarrollo

La raíz del workspace expone cuatro comandos públicos. Los scripts
especializados permanecen disponibles como aliases compatibles para
automatización y diagnóstico.

## Interfaz pública

| Comando | Alcance | Servicios externos |
| --- | --- | --- |
| `pnpm start` | Desarrollo diario con limpieza y configuración regenerable. | PostgreSQL local cuando la aplicación lo requiere. |
| `pnpm check` | Controles rápidos del workspace. | No. |
| `pnpm quality:gate` | Integración local canónica completa. | Sí: Docker y servicios locales. |
| `pnpm release:check:strict` | Gate estricto con mutación y evidencia externa. | Sí. |

## Modos de inicio

```bash
pnpm start
pnpm start --mode=i18n
pnpm start --mode=full
pnpm start --help
```

| Invocación | Implementación reutilizada | Uso |
| --- | --- | --- |
| Sin flags | `dev:fresh` | API y web base para desarrollo diario. |
| `--mode=i18n` | `dev:i18n` | Solo builds localizados `es`, `en` y `pt-BR`. |
| `--mode=full` | `dev:full:i18n` | API, infraestructura local y los tres builds localizados. |

Un modo desconocido termina con código `1`. `Ctrl+C` se propaga al proceso de
desarrollo seleccionado.

## Perfil check

`pnpm check` usa el grafo de calidad existente y ejecuta, en orden topológico:

1. arquitectura;
2. quality scan;
3. auditoría de formularios;
4. paridad monetaria de PDF;
5. lint;
6. tests unitarios y del workspace con cobertura de API.

El perfil no inicia Docker, no aplica migraciones y no ejecuta E2E, builds
localizados, mutation testing ni evidencia externa. Sus resultados se escriben
en `artifacts/check.json` y `artifacts/check.log`; no sobrescriben evidencia del
Quality Gate.

## Aliases compatibles

| Alias | Uso especializado |
| --- | --- |
| `pnpm dev:fresh` | Implementación del inicio predeterminado. |
| `pnpm dev:i18n` | Servidor web localizado sin garantizar API. |
| `pnpm dev:full:i18n` | Entorno localizado integral. |
| `pnpm lint` | Solo lint del workspace. |
| `pnpm test` | Solo tests del workspace. |
| `pnpm build` | Solo build del workspace. |
| `pnpm doctor` | Diagnóstico de herramientas, variables y PostgreSQL. |
| `pnpm run setup` | Inicialización local de PostgreSQL y Prisma. |
| `pnpm e2e` | Suite Playwright con ciclo de procesos controlado. |
| `pnpm quality:gate:ci` | Perfil canónico preparado para GitHub Actions. |
| `pnpm release:check` | Gate pre-release sin evidencia estricta. |

Los controles internos y sus dependencias están documentados en
[Quality Pipeline](../testing/QUALITY_PIPELINE.md).
