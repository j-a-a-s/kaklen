# Coverage Baseline

Fecha: 2026-07-15

Comando ejecutado:

```text
pnpm test:coverage
```

La primera ejecucion dentro del sandbox fallo por `listen EPERM` en Supertest. La medicion valida se ejecuto fuera del sandbox porque las pruebas E2E de Auth abren un servidor HTTP local.

## Resumen Inicial

| Metrica | Cobertura |
| --- | ---: |
| Statements | 59.81% |
| Branches | 32.97% |
| Functions | 29.42% |
| Lines | 58.58% |

## Archivos Prioritarios

| Archivo | Statements | Branches | Functions | Lines | Motivo |
| --- | ---: | ---: | ---: | ---: | --- |
| `apps/api/src/events/events.service.ts` | 9.23% | 10.36% | 7.93% | 8.33% | Vertical critica con transiciones, tareas, recursos y aislamiento. |
| `apps/api/src/organizations/organizations.service.ts` | 10.34% | 0.00% | 2.94% | 9.00% | RBAC, invitaciones, membresias y ultimo OWNER. |
| `apps/api/src/quotations/quotations.service.ts` | 28.77% | 27.27% | 30.00% | 27.48% | Estado, dinero, snapshots y versionado. |
| `apps/api/src/organizations/organization-access.guard.ts` | 45.83% | 0.00% | 50.00% | 40.90% | Guard principal multiempresa/RBAC. |
| `apps/api/src/events/events.controller.ts` | 58.46% | 100.00% | 3.57% | 57.14% | Superficie HTTP no ejercitada por unit tests. |
| `apps/api/src/quotations/quotations.controller.ts` | 60.00% | 0.00% | 7.14% | 57.89% | Superficie HTTP no ejercitada por unit tests. |

## Estrategia De Mejora

- Priorizar servicios criticos con Prisma fake y transacciones reales de test.
- Cubrir caminos negativos de organizacion ajena, recurso inexistente y transiciones invalidas.
- Agregar matriz de permisos y guard de organizacion con tabla parametrizada.
- Medir nuevamente con `pnpm test:coverage` y generar `docs/testing/COVERAGE_REPORT.md`.
