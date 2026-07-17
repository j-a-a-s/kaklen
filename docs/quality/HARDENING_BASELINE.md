# Baseline de hardening y consistencia

Fecha del inventario: 2026-07-17
Rama inspeccionada: `main`
Commit base: `ebf3b3a`

Este baseline registra el estado ejecutable posterior a la estabilización integral y delimita el trabajo de hardening. La evidencia detallada de formularios, interacción, dinero, documentos, portal, notificaciones, pagos, sesión y pruebas permanece en sus documentos especializados; aquí se conserva la trazabilidad de síntoma, reproducción, causa y control de regresión.

## Estado comprobado

- `pnpm quality:gate`: `QUALITY GATE PASSED`.
- `pnpm release:check`: `RELEASE READY`.
- Cobertura: 96.94% statements, 85.23% branches, 93.71% functions y 97.20% lines.
- Formularios: 25 formularios y 101 controles reactivos auditados.
- Datos demo: 4 usuarios, 4 organizaciones, 40 clientes, 48 ítems de catálogo, 32 cotizaciones y 20 eventos; 0 referencias huérfanas.
- Migraciones: 18 archivos SQL versionados, todos con contenido; la base local existente reporta 32 tablas y estado sincronizado.
- i18n: 889 unidades disponibles en `es`, `en` y `pt-BR`.
- E2E: 31 recorridos de producto y 11 controles específicos de accesibilidad y responsive.

## Matriz de diagnóstico

| Área | Síntoma y reproducción | Causa raíz | Módulos afectados | Solución compartida | Control de regresión | Estado inicial |
| --- | --- | --- | --- | --- | --- | --- |
| Migraciones Prisma | `db:validate` confirma la base actual, pero no demuestra que un entorno vacío pueda aplicar todo el historial ni que coincida con `schema.prisma`. | El repositorio no tiene un verificador aislado de `migrate deploy`, estado, estructura e índices desde cero. | `prisma/`, scripts DB, release y quality gate. | Crear `db:verify:migrations` sobre un schema temporal, validar SQL, aplicar historial, comparar estructura, ejecutar seed y eliminar el schema. | Tests del núcleo del script y ejecución real en release/quality gate. | Abierto para este sprint. |
| Schema y modelos runtime | Un modelo agregado solo al schema podría pasar inadvertido contra una base previamente migrada. | La validación existente consulta conectividad y tablas, no columnas e índices críticos por modelo. | Prisma, autenticación, portal, pagos, notificaciones y proveedores. | Inventario tipado de tablas, columnas e índices críticos verificado en la reconstrucción limpia. | `db:verify:migrations` falla ante cualquier ausencia. | Abierto para este sprint. |
| Formularios | Antes podían aparecer labels concatenados, helpers que movían filas y errores genéricos. Se reproduce con submit inválido y wizard de cotización. | Estructura, límites y accesibilidad se definían por pantalla. | Auth, organizaciones, clientes, catálogo, cotizaciones, eventos y portal. | Componentes de feedback, directiva a11y, matriz de campos y `CountryBusinessPolicy`. | `forms:audit`, tests web y E2E de validación visible. | Cerrado en `ebf3b3a`; revalidar. |
| Botones y tooltips | Acciones equivalentes tenían jerarquía y textos largos inconsistentes. | Variantes e interacción no compartían contrato. | Design system y superficies operativas. | Directivas `uiButton` y `uiTooltip`, iconos y estados comunes. | Tests de directivas y contratos de producto. | Cerrado; revalidar. |
| Dropdowns | Menús podían quedar desanclados o conservar listeners al cerrar. | Posicionamiento y lifecycle estaban distribuidos. | Menús de acciones, perfil y organización. | `ActionMenuComponent` y coordinador único de overlays. | Tests de teclado, click externo, cierre y foco. | Cerrado; revalidar. |
| Centro de acciones | Algunas rutas y búsquedas no compartían permisos ni comportamiento de teclado. | Registro de acciones y búsqueda remota estaban acoplados a la vista. | Command Palette, navegación y búsqueda del asistente. | `ActionRegistry`, grupos, RBAC y manejo de foco centralizado. | Tests por acción, contratos y E2E asistido. | Cerrado; revalidar. |
| Busy global | Operaciones concurrentes podían competir por el cursor o dejarlo activo. | Los componentes administraban estado de progreso de forma local. | Navegación, auth, PDF, WhatsApp, pagos y organización. | `GlobalBusyService` con contador, demora y exclusiones de background. | Fake timers y tests de interceptor/cleanup. | Cerrado; revalidar. |
| Sesión inactiva | Una pestaña podía mantener contexto después de expirar o cerrar otra. | No existía una política coordinada de actividad y logout. | Auth, overlays, organización y navegación. | `SessionIdleService`, warning 240/300 segundos y `BroadcastChannel`. | Fake timers, canal entre pestañas y E2E de logout limpio. | Cerrado; revalidar. |
| Dinero y descuentos | Frontend y API podían divergir por flotantes o por `NONE` con valor. | Reglas y redondeo estaban duplicados. | Shared, cotizaciones API y wizard web. | Cálculo puro por unidades menores, distribución determinista y validación común. | Tests de 0/5/100%, fixed, porcentaje, IVA, exento y residuos. | Cerrado; revalidar. |
| PDF | El documento anterior no reunía todos los datos ni una paginación consistente. | Render y preparación de datos no compartían ViewModel. | Cotizaciones, organización y descarga web. | `QuotationDocumentService` y un ViewModel único. | Tests de `%PDF`, texto, varias páginas, RBAC y descarga E2E real. | Cerrado; revalidar. |
| Correo | Acciones comerciales podían confundirse con correos de seguridad. | No había separación explícita por feature flag. | MailService, auth y cotizaciones. | `AUTH_EMAIL_ENABLED=true`, `COMMERCIAL_EMAIL_ENABLED=false` y logs sanitizados. | Mailpit real, tests de aceptación/rechazo y E2E de verificación/recuperación. | Cerrado; revalidar. |
| Portal cliente | Aprobar una versión antigua o exponer IDs internos suponía riesgo. | El acceso público carecía de contrato versionado completo. | Portal, cotizaciones, historial y notificaciones. | Token aleatorio hasheado, expiración, revocación y vínculo a versión. | Tests de token, versión obsoleta, cambios y E2E público. | Cerrado; revalidar. |
| WhatsApp | Un enlace preparado podía presentarse como mensaje enviado. | No se distinguían transporte manual y proveedor real. | WhatsApp, cotización y portal. | `WhatsAppNotificationService` con modos `manual`/`provider` y estado `prepared`. | Tests de contenido seguro, normalización y E2E manual. | Manual cerrado; proveedor externo pendiente. |
| Notificaciones | Eventos de portal y pago no tenían un centro interno consistente. | Faltaba un modelo multiempresa y una API de lectura común. | Notificaciones API/web, portal y pagos. | Centro in-app con audiencia, contador, lectura y rutas. | Tests de aislamiento, idempotencia y E2E. | Cerrado; revalidar. |
| Pago sandbox | El retorno del navegador podía confundirse con confirmación final. | No existía un gateway con lifecycle y webhook como fuente de verdad. | Pagos, portal y notificaciones. | `PaymentGateway` y `SandboxPaymentGateway` idempotentes con firma. | Suites de lifecycle/webhook y E2E sandbox. | Sandbox cerrado; proveedor real pendiente. |
| Perfil proveedor | La invitación podía aparecer antes del objetivo principal o duplicarse. | Elegibilidad, consentimiento y unicidad no estaban centralizados. | Portal y `ProviderProfiles`. | Flujo opcional posterior a aprobación/pago y unicidad por cliente/organización. | Tests de elegibilidad, consentimiento, analytics sin PII y E2E. | Cerrado; marketplace público fuera de alcance. |
| Responsive y accesibilidad | El wizard podía recortar labels en móvil aun sin overflow del documento. | El host del wizard y los pasos no tenían restricciones estables. | Design system, formularios, portal y pago. | Retículas responsivas, steps 2x2 en móvil, foco y targets compartidos. | Siete viewports, assertions de clipping/overflow y suite accesible. | Cerrado; revalidar visualmente. |
| i18n y terminología | Builds extranjeros podían mostrar keys, enums o texto español. | Faltaban mapeos localizados únicos para estados y eventos. | XLIFF, labels, portal, pagos, sesión y notificaciones. | Catálogos completos y mapeos de display centralizados. | Builds `es`/`en`/`pt-BR`, server verify y E2E. | Cerrado; revalidar. |
| Quality Gate | El gate cubre producto, pero usa `db:validate` sobre la base existente. | La reconstrucción limpia de migraciones no forma parte del pipeline. | `quality-gate.mjs` y `release-check.mjs`. | Insertar `db:verify:migrations` antes de pruebas que mutan datos. | El único cierre válido continúa siendo `QUALITY GATE PASSED`. | Abierto para este sprint. |

## Criterio de cierre

El hardening queda cerrado cuando el historial completo se aplica en un schema temporal vacío, Prisma no detecta diferencias, seed y verificación demo pasan allí, la estructura crítica coincide, release y quality gate incluyen ese control, la revisión visual no encuentra regresiones y el árbol Git queda limpio.

## Evidencia final

- `db:verify:migrations` reconstruyó un schema PostgreSQL aislado con las 18 migraciones, verificó 32 tablas, 131 índices y todas las columnas críticas, ejecutó `migrate status`, confirmó ausencia de drift contra `schema.prisma`, sembró/verificó el demo y eliminó el schema temporal.
- `release:check` y `quality:gate` ejecutan la reconstrucción limpia antes de cualquier prueba que muta datos. Ambos terminaron respectivamente en `RELEASE READY` y `QUALITY GATE PASSED`.
- `forms:audit` volvió a confirmar 25 formularios y 101 controles reactivos sin hallazgos.
- La revisión en navegador cubrió `320x568`, `390x844`, `768x1024`, `820x1180`, `1366x768`, `1440x900` y `1920x1080`, en `es`, `en` y `pt-BR`, sin overflow del documento ni errores o warnings de consola.
- La inspección visual encontró una superposición interna en las acciones de búsqueda del primer paso de cotizaciones a 820 px. La fila ahora reserva una línea completa para la búsqueda y dos columnas estables para las acciones; una prueba de contrato protege esa retícula.
- La cobertura consolidada quedó en 96.94% statements, 85.23% branches, 93.71% functions y 97.20% lines. Las suites E2E y de accesibilidad completaron 31 y 11 recorridos, respectivamente.
- El dataset local fue restaurado después de las pruebas con 4 usuarios, 4 organizaciones, 40 clientes, 48 ítems de catálogo, 32 cotizaciones y 20 eventos, 0 huérfanos y huella `560cd7bb6b42efc1`.

## Cierre por área

| Área | Estado final |
| --- | --- |
| Migraciones Prisma | Cerrado: 18 migraciones reconstruidas desde cero y sin drift. |
| Schema y modelos runtime | Cerrado: 32 tablas, columnas críticas y 131 índices verificados. |
| Formularios | Cerrado: 25 formularios y 101 controles pasan la auditoría. |
| Botones y tooltips | Cerrado: variantes, estados, iconos y labels largos revalidados. |
| Dropdowns | Cerrado: overlay, foco, teclado, viewport y lifecycle cubiertos. |
| Centro de acciones | Cerrado: acciones, búsqueda, RBAC, tenant y teclado cubiertos. |
| Busy global | Cerrado: contador, demora, exclusiones y cleanup cubiertos. |
| Sesión inactiva | Cerrado: warning, expiración, limpieza y sincronización entre pestañas cubiertos. |
| Dinero y descuentos | Cerrado: algoritmo shared exacto y paridad API/web comprobados. |
| PDF | Cerrado: ViewModel, paginación, RBAC y descarga real comprobados. |
| Correo | Cerrado en alcance: correo de seguridad activo y comercial deshabilitado por política. |
| Portal cliente | Cerrado: token, versiones, aprobación y cambios comprobados. |
| WhatsApp | Cerrado en modo manual; integración con proveedor externo pendiente. |
| Notificaciones | Cerrado: audiencia, lectura, rutas, idempotencia y aislamiento comprobados. |
| Pagos | Cerrado en sandbox; gateway productivo pendiente. |
| Perfil proveedor | Cerrado en alcance; marketplace público fuera del sprint. |
| Responsive y accesibilidad | Cerrado: siete viewports y tres locales revisados sin hallazgos pendientes. |
| i18n y terminología | Cerrado: catálogos, builds y rutas `es`, `en`, `pt-BR` comprobados. |
| Quality Gate | Cerrado: incluye migraciones limpias y finaliza en `QUALITY GATE PASSED`. |
