# Technical Scorecard

Fecha: 2026-07-15

La nota se calcula como `criterios cumplidos / criterios totales * 10`. No se redondea hacia arriba. La nota global es promedio simple de las 10 areas.

## Scorecard Actual

| Area | Criterios | Cumplidos | Nota | Evidencia |
| --- | ---: | ---: | ---: | --- |
| Arquitectura general | 3 | 3 | 10.00 | `pnpm architecture:check`, `pnpm quality:scan`, `docs/architecture/ARCHITECTURE_REVIEW.md` |
| Backend y modulos centrales | 3 | 3 | 10.00 | `pnpm release:check`, `pnpm verify:api-build`, health ready DB |
| Frontend y navegacion | 3 | 3 | 10.00 | `pnpm accessibility:test`, session cleanup tests, version tests |
| Tests automatizados | 5 | 1 | 2.00 | `pnpm test` pasa; coverage no cumple 90/85/90/90 |
| i18n | 3 | 3 | 10.00 | `pnpm verify:i18n-server`, XLIFF tests, localized Playwright smoke |
| Seguridad | 5 | 5 | 10.00 | secret scan, SAST local, dependency audit, SBOM, security docs |
| Developer Experience | 3 | 3 | 10.00 | doctor/setup/release scripts, DB scripts, INSTALL |
| AWS staging | 3 | 1 | 3.33 | docs creados; staging real no validado |
| Observabilidad y operacion | 3 | 3 | 10.00 | health/live/ready, request id logs, runbook, incident response |
| Madurez productiva | 3 | 3 | 10.00 | E2E MVP, accessibility smoke, scorecard |

Nota global actual medida por `pnpm release:check:strict`: **8.53/10**.

## Bloqueantes Para 10/10

- Cobertura API actual medida: statements 59.81%, branches 32.97%, functions 29.42%, lines 58.58%.
- Umbrales requeridos: statements 90%, branches 85%, functions 90%, lines 90%.
- AWS staging real no fue desplegado ni validado con credenciales reales.
- Cookies `Secure`, CORS staging, RDS backups, CloudFront cache e invalidacion no fueron comprobados en staging real.

## Decision

Estado final estricto: `RELEASE BLOCKED FOR 10/10`.

El proyecto puede seguir siendo candidato a tag alpha local si `pnpm release:check` pasa, pero no alcanza 10/10 hasta cerrar los bloqueantes anteriores.
