# Final Repository Consolidation

## Estado

La consolidación integra el trabajo válido descubierto, conserva historial y deja trazabilidad de cada
decisión. El Quality Gate, el clon limpio y el CI remoto pasaron sobre el mismo código certificado en
`main`.

## SHAs e integraciones

| Elemento | SHA | Resultado |
| --- | --- | --- |
| `main` inicial | `4dffa9251a929b491b8e2cdd257666e75d73ed88` | Inventariado |
| Head esperado PR #32 | `49cb20d7a627cc3b8163b31b2e0235b7301e30e7` | Verificado |
| Merge PR #32 | `ed2a1c0311c7b7303bf248a0eeed9a3f5b879027` | Fusionado |
| Marketing y leads | `1044b578099bce3345fbe4c4c5f64494384f62c1` | Integrado |
| Merge local de Marketing | `3e984d44010273b45f239902b6ae384115061866` | Integrado en `main` |
| Build Docker reproducible | `d379eeb` | Corregido y probado |
| Lock atómico del Quality Gate | `bf3fdcb` | Corregido y probado con concurrencia |
| Scorecard sincronizado | `8b72d85` | Código certificado |
| Kokecore fijado | `b0025e737d94a1dae4be2f8f71dcdcfea72c695f` | Sin cambios |

El trabajo de Marketing existía como cambios no confirmados sobre una rama cuyo HEAD ya estaba
integrado. Se trasladó a un clon limpio, se endureció, se probó y se confirmó sin alterar el checkout
original. El rollback está respaldado por
`archive/pre-consolidation-marketing-leads-20260723`.

## Ramas

Las ramas `feature/auth`, `feature/aws-staging-infrastructure`, `feature/catalog`,
`feature/crm-clients`, `feature/foundation`, `feature/i18n-foundation`,
`feature/organizations-rbac` y `feature/quotations` se clasificaron **A**. `git branch -r --merged
origin/main` confirmó que sus HEAD eran ancestros de `main`; luego se eliminaron del remoto.

Los ocho PR Dependabot abiertos se clasificaron **D** y se cerraron con comentario individual. No
contenían código de producto: eran actualizaciones mayores aisladas, parciales o un grupo transversal
de runtimes. Los PR #31, #29, #24 y #20 fallaban el Quality Gate; #24 además estaba en conflicto.
Integrarlos habría mezclado migraciones de Angular 22, TypeScript 7 y Actions mayores con una base
Angular 20 no migrada. Sus ramas se eliminaron y Dependabot puede regenerar propuestas coordinadas.

No quedó ninguna rama con clasificación **E**.

## Carpetas y archivos

| Path | Clasificación | Evidencia | Decisión |
| --- | --- | --- | --- |
| `apps`, `packages`, `prisma`, `infra`, `scripts`, `e2e` | ACTIVE | Workspaces, imports, migraciones, CI y comandos | Conservar |
| `docs` | ACTIVE | Índice y contratos de documentación | Conservar |
| `artifacts` | ACTIVE | Evidencia oficial permitida por `.gitignore` | Conservar solo allowlist |
| `vendor/kokecore` | ACTIVE | Submódulo fijado y consumido por workspaces | Conservar |
| `infra/aws` | ARCHIVE | Su README declara contexto histórico y enlaza la fuente Terraform actual | Conservar |
| `.artifacts`, `.turbo`, `coverage`, `dist`, `node_modules`, `out-tsc` | GENERATED | Regenerados por comandos y cubiertos por `.gitignore` | No versionar |
| `playwright-report`, `test-results` | GENERATED | Salidas E2E ignoradas | No versionar |

`git ls-files` no encontró `dist`, `coverage`, `node_modules`, reportes Playwright, planes Terraform,
tarballs, logs ni `*.tsbuildinfo` versionados. Tampoco se encontraron carpetas `old`, `backup`,
`archive`, `tmp` o `temp` desconocidas. No se eliminó ninguna carpeta de fuente: no hubo una candidata
confirmada como duplicada u obsoleta.

## Seguridad y hacking ético

El canal público `POST /api/leads` incorpora DTO estricto, honeypot, rate limit distribuido de cinco
solicitudes por minuto e IP, consentimiento independiente, teléfono E.164 y evidencia de IP/user-agent
solo mediante HMAC. El correo escapa HTML y neutraliza cabeceras; la respuesta no expone mensajes
literales de proveedores. El frontend limita tamaño y tiempo de respuestas, omite credenciales,
traduce códigos permitidos y aplica CSP y cabeceras anti-framing.

Las pruebas hostiles cubren XSS almacenado, inyección de cabeceras, overposting, prototype pollution,
metadatos y URLs maliciosas, honeypot, abuso de rate limit, payloads de proveedor, timeout, JSON-LD y
filtración de errores. El detalle del modelo de amenazas está en
[`MARKETING_LEAD_SECURITY.md`](../security/MARKETING_LEAD_SECURITY.md).

La auditoría de dependencias detectó y corrigió dos vulnerabilidades altas transitivas recién
publicadas: PostCSS se fijó en `8.5.22` y sharp en `0.35.3`. La repetición sobre 1.355 paquetes terminó
con cero vulnerabilidades high/critical. El secret scan, SAST y SBOM pasaron.

## Validaciones ejecutadas

- Tests de raíz: 274/274.
- API: 59 suites, 549/549 tests.
- Angular: 105/105 tests.
- Marketing: 3 tests de cabeceras y 13 tests Jest.
- Cobertura API: 96,73% statements, 85,47% branches, 94,84% functions y 97,09% lines.
- Prisma generate, migración incremental y replay desde cero: 20 migraciones, 34 tablas y 138 índices.
- Terraform 1.15.8: format, validate y plan.
- TFLint 0.64.0: todos los módulos.
- Trivy 0.72.0: dos hallazgos de diseño aceptados y documentados; cero hallazgos bloqueantes.
- Plan staging: 96 altas, 0 cambios y 0 destrucciones.
- Build de 13 paquetes, incluido Next.js sin acceso a fuentes remotas.
- Clon limpio con submódulos: instalación frozen, `pnpm check` y `pnpm quality:gate` pasaron.
- Quality Gate limpio: `QUALITY GATE PASSED` en 581.826 ms.
- E2E: 37/37 recorridos Playwright.
- Docker API y Web: imágenes `linux/amd64` construidas correctamente.
- CI remoto del SHA `8b72d85cc7dd72e4bc9a338247be3c47c86f46a8`: Quality Gate e
  Infrastructure completados con `success`.

Los binarios temporales de infraestructura se compararon contra checksums oficiales antes de usarse.
La evidencia estructurada del Quality Gate, el clon limpio y el CI remoto se registra en
`artifacts/final-repository-consolidation.json`.

## Conflictos y eliminaciones

PR #32 se fusionó sin conflictos. Marketing/Leads se integró desde un checkout limpio y no requirió
resoluciones automáticas. Se eliminaron 16 ramas remotas auditadas: ocho funcionales totalmente
integradas y ocho Dependabot cerradas. No se eliminó código fuente, migraciones, evidencia canónica ni
el submódulo.

## Riesgos residuales

- La infraestructura se certifica mediante plan sin credenciales; un despliegue AWS real y sus
  validaciones externas permanecen fuera de esta consolidación.
- La retención y eliminación de leads necesita una política operativa antes de producción.
- WhatsApp real requiere proveedor, secretos y E2E autorizados; el modo actual no simula una entrega.
- Marketing aún necesita un pipeline de despliegue aprobado si se publica como aplicación separada.
- Los upgrades mayores cerrados deben retomarse como migraciones coordinadas, no como PR aislados.

## Rollback

1. Identificar el merge de Marketing `3e984d44010273b45f239902b6ae384115061866`.
2. Revertir ese merge con un commit normal; no reescribir `main`.
3. Usar `archive/pre-consolidation-marketing-leads-20260723` para inspeccionar o restaurar el slice.
4. Aplicar rollback de Prisma mediante una migración compensatoria; nunca borrar migraciones
   aplicadas.
5. Volver a ejecutar `pnpm quality:gate` antes de desplegar.
