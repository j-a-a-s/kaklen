# Quality Enforcement Baseline

Fecha de medicion: 2026-07-17
Rama: `main`
SHA inicial: `7eaf3a0b70ee8a6caf2574d87bcaae686da482a4`

Este documento registra el estado observado antes del sprint de cierre. No describe el
resultado final ni reemplaza los artefactos generados por el pipeline.

## Comandos ejecutados

| Comando | Resultado previo | Hallazgo |
| --- | --- | --- |
| `pnpm forms:audit` | Paso: 25 formularios y 101 controles reactivos | El analisis era regex, omitía `select`, componentes personalizados, templates externos y paridad entre validators, indicador y ARIA. |
| `pnpm test:coverage` | Paso | Statements 96.94%, branches 85.23%, functions 93.71%, lines 97.20%. |
| `pnpm quality:gate` | Paso | El runner invocaba `release:check` y repetía seed, lint, tests, builds, i18n y E2E. No generaba un grafo ni un artefacto canónico de ejecucion. |

## Brechas confirmadas

1. El contrato `kaklen-form-field` existía, pero los formularios seguían usando etiquetas e indicadores manuales.
2. El resumen de errores dependía de `submitted`; los pasos intermedios de Cliente, Cotizacion y Evento mostraban avisos genéricos.
3. El ViewModel PDF convertía montos con `Number`, calculaba descuentos con punto flotante y redondeaba con `toFixed`.
4. GitHub Actions repetía comandos en vez de ejecutar un único gate canónico y no publicaba cobertura ni scorecard actual.
5. `quality:gate`, `release:check` y `release:check:strict` mantenían listas de tareas independientes y anidadas.
6. `TECHNICAL_SCORECARD.md` declaraba una cobertura de 59.81%/32.97%/29.42%/58.58%, distinta de la medicion vigente.

## Criterio de comparacion

El cierre debe reemplazar estas mediciones manuales por `artifacts/quality-gate.json` y
`artifacts/technical-scorecard.json`, asegurar una sola ejecucion por clave y mantener o
mejorar los umbrales de cobertura registrados arriba.

## Cierre implementado

- Auditor estructural con TypeScript Compiler API y parser Angular; 25 formularios y 137 controles.
- `WizardValidationState` y Error Summary con `attempted`/`scopePaths` en Cliente, Cotización y Evento.
- ViewModel PDF alimentado solo por `calculateQuotationMoney()` y comparación persistida en unidades menores.
- Grafo canónico compartido por cuatro perfiles, fail-fast y evidencia JSON sin secretos.
- Único check CI `Kaklen Quality Gate`, con PostgreSQL, Redis, Mailpit y artefactos completos.
- Scorecard determinista generado desde cobertura, formularios, migraciones, gate, E2E, i18n, seguridad y validaciones externas.
