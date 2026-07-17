# Coverage Report

Fecha: 2026-07-17

Comandos principales:

```text
pnpm test:coverage
pnpm test:mutation:critical
```

## Estabilización integral de producto

La entrega iniciada en `1581565` aumentó el universo instrumentado con portal público,
pagos sandbox, perfiles de proveedor, WhatsApp y notificaciones internas. La comparación
se realiza contra la medición tomada antes de modificar código y registrada en
`docs/quality/STABILIZATION_BASELINE.md`.

| Métrica | Baseline estabilización | Final estabilización | Cubiertos / total |
| --- | ---: | ---: | ---: |
| Statements | 96.69% | 96.94% | 2985 / 3079 |
| Branches | 85.18% | 85.23% | 1218 / 1429 |
| Functions | 93.59% | 93.71% | 611 / 652 |
| Lines | 96.95% | 97.20% | 2819 / 2900 |

Resultado: 46 suites y 341 pruebas API aprobadas. Ninguna métrica quedó bajo el
baseline, aun cuando la entrega incorporó nuevos módulos de negocio completos.

## Resultado histórico de ampliación de cobertura

| Metrica | Baseline | Final | Umbral |
| --- | ---: | ---: | ---: |
| Statements | 59.81% | 97.99% | 90% |
| Branches | 32.97% | 89.60% | 85% |
| Functions | 29.42% | 96.36% | 90% |
| Lines | 58.58% | 97.95% | 90% |

## Modulos Criticos

El gate `pnpm test:coverage` valida ademas que los modulos criticos tengan al menos 95% en statements y lines.

| Modulo | Statements | Lines | Estado |
| --- | ---: | ---: | --- |
| Auth | 99.43% | 99.40% | OK |
| Organizations/RBAC | 99.28% | 99.24% | OK |
| Clients | 100.00% | 100.00% | OK |
| Quotations | 99.23% | 99.19% | OK |
| Events | 97.17% | 97.10% | OK |

## Cobertura Agregada

Se agregaron pruebas unitarias e integradas para:

- Auth: refresh/logout/me, usuarios inactivos, refresh tokens invalidos y guard JWT.
- RBAC: matriz de permisos por rol, membresia activa, organizacion faltante y permisos insuficientes.
- Organizations: owner inicial, slug, miembros, invitaciones, ultimo owner y permisos.
- Clients: CRUD, filtros, taxId duplicado, interacciones, aislamiento de organizacion y actualizacion completa.
- Quotations: calculo monetario, descuentos, snapshots de catalogo, filtros, estados, versionado y PDF localizado.
- Events: CRUD, transiciones, cotizacion aprobada, tareas, participantes, recursos, timeline y aislamiento.
- Errores e infraestructura: filtro global de errores, storage keys, S3/local storage, health, Prisma lifecycle, bootstrap de API y DTO validation.

## Mutation Critical

`pnpm test:mutation:critical` aplica mutaciones reales y temporales sobre caminos criticos. Cada mutante debe ser detectado por pruebas focales antes de restaurar el archivo original.

| Mutante | Spec que lo detecta |
| --- | --- |
| Bypass de permisos RBAC | `organization-access.guard.spec.ts` |
| Descuento porcentual de cotizacion mayor a 100% | `quotations.service.spec.ts` |
| Evento con fin igual al inicio | `events.service.spec.ts` |
| Tax ID duplicado en cliente | `clients.service.spec.ts` |
| Header Bearer malformado en JWT guard | `jwt-auth.guard.spec.ts` |

## Pendientes No Bloqueantes

- Catalog queda sobre el umbral global pero bajo 95% agregado en statements/lines; no se marco como critico en este gate porque el foco de esta entrega fue Auth, RBAC, Organizations, Clients, Quotations y Events.
- El run de cobertura muestra un warning de Jest sobre cierre forzado de un worker. Los specs focales de storage/prisma ya fueron verificados con `--detectOpenHandles`; conviene seguir reduciendo handles abiertos en una tarea dedicada si reaparece en CI.
