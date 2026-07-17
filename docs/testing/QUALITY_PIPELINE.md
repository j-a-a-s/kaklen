# Canonical Quality Pipeline

`scripts/quality-pipeline-core.mjs` define un grafo de tareas con key, label, comando, argumentos, dependencias, entornos, timeout, artefactos y obligatoriedad. `scripts/quality-pipeline.mjs` resuelve el perfil, ejecuta sin shell, conserva exit code/señal, falla rápido y escribe `artifacts/quality-gate.json` más un log técnico sanitizado.

## Profiles

| Profile | Purpose | Environment |
| --- | --- | --- |
| `pnpm quality:gate` | Validación local completa y servicios Docker | local |
| `pnpm quality:gate:ci` | Check canónico con servicios provistos por Actions | CI |
| `pnpm release:check` | Evidencia local previa a tag | local |
| `pnpm release:check:strict` | Lo anterior más mutación crítica y validaciones externas | local |

Los perfiles seleccionan tareas; ninguno ejecuta otro perfil. El resolver topológico garantiza una ejecución máxima por key y respeta todas las dependencias.

## Artifact Reuse

- `test` ejecuta Jest API con cobertura; `test:coverage` valida el summary existente.
- `build:es`, `build:en` y `build:pt-BR` se ejecutan una vez; `verify:i18n-server` valida esos outputs.
- E2E reutiliza Prisma, packages y builds localizados después de verificar que existen.
- La suite E2E completa incluye accesibilidad y escribe `artifacts/e2e-result.json`; el control de accesibilidad valida esa evidencia.
- `db:validate`, migraciones y SMTP omiten regeneraciones ya cubiertas por dependencias del grafo.

## CI And Evidence

GitHub Actions expone un único check obligatorio llamado `Kaklen Quality Gate`. El workflow prepara PostgreSQL, Redis, Mailpit, Node, pnpm y Chromium; después ejecuta solo `pnpm quality:gate:ci` y sube siempre calidad, scorecard, cobertura, E2E, SBOM y logs.

`pnpm scorecard:update` genera el documento versionado. `pnpm scorecard:verify` lo compara con métricas y evidencia vigentes y termina con `SCORECARD CURRENT`; un documento desactualizado bloquea el gate.
