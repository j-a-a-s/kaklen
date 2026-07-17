# Baseline de estabilización integral

Fecha del inventario: 2026-07-16
Rama inspeccionada: `main`
Commit base: `1581565`

Este documento registra el estado comprobado antes de modificar código para la estabilización. Las brechas se obtuvieron mediante inspección de Prisma, DTO, servicios, componentes, rutas, permisos, traducciones, tests y scripts, además de ejecutar la cobertura existente.

## Inventario actual

### Formularios

Se detectaron 23 superficies con formularios reactivos o filtros:

| Área | Formularios existentes |
| --- | --- |
| Autenticación | Login, registro, reenvío de verificación, recuperación, restablecimiento, aceptación de invitación |
| Organizaciones | Crear, configuración, invitar miembro |
| Clientes | Crear/editar, filtros, interacción |
| Catálogo | Crear/editar, filtros |
| Cotizaciones | Crear/editar por pasos, filtros, envío comercial por correo |
| Eventos | Crear/editar, filtros, tarea, participante, recurso, cronograma |

No existen todavía formularios de portal, solicitud de cambios, pago ni perfil profesional.

### Botones y componentes interactivos

- Se encontraron 139 usos de botones o enlaces con apariencia de botón.
- Las variantes CSS actuales incluyen primary implícito, `secondary`, `danger`, `ghost`, `success` y estados disabled.
- No existe un componente de botón que unifique loading, prevención de doble envío, tooltip y etiquetas accesibles.
- El componente contextual único actual es `ActionMenuComponent`; se usa en perfil, clientes, catálogo, cotizaciones, eventos y miembros.
- El menú se posiciona con rectángulos de ventana y `position: fixed`; no usa Overlay ni una coordinación global de instancia abierta.
- Existen iconos Lucide compartidos en `UiIconComponent`, incluido el conjunto principal requerido.

### Centro de acciones

- `CommandPaletteComponent` mezcla definición, permisos, búsqueda, navegación y renderizado.
- No existe `ActionRegistry` tipado e inyectable.
- La búsqueda local y remota existe, pero su matriz de acciones no tiene un test independiente por acción/ruta.
- El backend expone búsqueda multi-recurso mediante `GET /api/organizations/:organizationId/assistant/search`.

### API de cotizaciones

Endpoints actuales:

- `POST /api/organizations/:organizationId/quotations`
- `GET /api/organizations/:organizationId/quotations`
- `GET /api/organizations/:organizationId/quotations/summary`
- `GET /api/organizations/:organizationId/quotations/:quotationId`
- `PATCH /api/organizations/:organizationId/quotations/:quotationId`
- `DELETE /api/organizations/:organizationId/quotations/:quotationId`
- `POST .../:quotationId/send`
- `POST .../:quotationId/approve`
- `POST .../:quotationId/reject`
- `POST .../:quotationId/cancel`
- `POST .../:quotationId/new-version`
- `GET .../:quotationId/history`
- `GET .../:quotationId/pdf`
- `POST .../:quotationId/email`

No existen endpoints públicos, solicitud de cambios, enlace seguro, WhatsApp, pagos ni recibos.

### Persistencia y estados

- `QuotationStatus`: `DRAFT`, `SENT`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`.
- `EventStatus`: `DRAFT`, `CONFIRMED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `ARCHIVED`.
- No existe `CHANGES_REQUESTED` ni un estado de pago en cotizaciones.
- No existen modelos persistentes para notificaciones internas, enlaces públicos, mensajes WhatsApp, pagos, intentos, webhooks, reembolsos, recibos o perfiles de proveedor.
- Los estados visibles principales cuentan con mapeos localizados en `display-labels.ts`, pero todavía hay textos técnicos como `CRM`, `Lead` y claves de auditoría en superficies secundarias.

### Clientes y política por país

- Prisma permite `taxId`, `email`, `phone` y `whatsapp` nulos.
- El DTO valida RUT chileno solo cuando el valor está presente.
- El servicio exige RUT únicamente a empresas chilenas; una persona natural chilena puede omitirse.
- WhatsApp es opcional para todos los clientes.
- Región y comuna están codificadas dentro de `ClientFormComponent`; solo tres regiones tienen comunas precargadas.
- No existe un contrato central `CountryBusinessPolicy` compartido por frontend y backend.

### Cálculo monetario y documento

- `calculateQuotationMoney` ya es una función compartida basada en enteros escalados.
- El descuento global se aplica de forma individual por porcentaje sobre cada línea elegible; no distribuye explícitamente un total con asignación de residuo determinista.
- La combinación `NONE` con un valor no nulo no está expresada como invariante única en frontend y backend.
- El PDF se genera con `createSimplePdf`, coordenadas fijas y una sola página; no implementa tabla paginada, encabezados repetidos, número de página, metadata completa ni un ViewModel documental compartido.

### Correo, sesión y configuración

- Mailpit está configurado en puertos SMTP 1025 y UI 8025.
- Los correos de verificación y recuperación están implementados y probados.
- El endpoint y diálogo de correo comercial de cotización permanecen visibles/activos.
- No existen flags `AUTH_EMAIL_ENABLED` ni `COMMERCIAL_EMAIL_ENABLED`.
- No existen `GlobalBusyService` ni `SessionIdleService`.
- No hay sincronización de actividad/logout con `BroadcastChannel`.

### Responsive e i18n

- Hay builds `es`, `en` y `pt-BR`, con XLIFF y verificaciones del servidor localizado.
- La vista semanal de eventos ya navega por enlace completo y soporta Space.
- El calendario mensual cambia a una columna en móvil, pero no existe una matriz automatizada para los siete viewports requeridos.
- Hay un contenedor con `overflow-x: auto`; todavía no existe un control global de cero overflow horizontal.
- No hay traducciones para portal, pagos, centro persistente de notificaciones, WhatsApp, sesión o proveedor porque esas superficies no existen.

### Cobertura y Quality Gate

Cobertura base medida con `pnpm test:coverage` antes de cambios:

| Métrica | Cobertura | Cubiertos / total |
| --- | ---: | ---: |
| Statements | 96,69 % | 2224 / 2300 |
| Branches | 85,18 % | 943 / 1107 |
| Functions | 93,59 % | 482 / 515 |
| Lines | 96,95 % | 2104 / 2170 |

Resultado base: 36 suites API y 281 tests aprobados.

El Quality Gate actual ejecuta arquitectura, quality/secret scan, SMTP, contratos de producto/auth, base demo, lint, tests, cobertura, build, build API, tres locales, servidor i18n, E2E, accesibilidad y release. No incluye todavía auditoría de formularios, contratos de PDF, matriz monetaria, ActionRegistry, lifecycle de overlay, portal, pagos sandbox, notificaciones persistentes, sesión idle ni control explícito de claves/enums visibles y overflow.

## Brechas reproducidas y plan de corrección

| Problema reproducido | Causa raíz | Archivo o módulo | Corrección planificada | Evidencia/test requerido |
| --- | --- | --- | --- | --- |
| Botones con comportamiento y loading dispar | Estilo global sin contrato de interacción compartido | `design-system.css`, páginas web | Consolidar variantes, estado loading, foco, iconografía y bloqueo de doble envío | Unitarios de botón y E2E de doble acción |
| Texto largo puede desbordar o partirse sin ayuda | No existe tooltip accesible reutilizable ni política única | Design system y acciones | Crear directiva/componente tooltip, truncado y `aria-label` | Hover, foco, viewport y mobile |
| Menú contextual depende de coordenadas fijas | Posicionamiento manual sobre `body` | `shared/action-menu.component.ts` | Migrar al Overlay compatible, estrategia flexible y coordinador de una instancia | Posición, scroll, resize, click fuera, Escape y destroy |
| Formularios no comparten un contenedor de campo | Label/helper/error se repiten en templates | `shared/forms`, 23 formularios | Crear `FormField`, `FieldHelper`, summary enlazable y wizard step | Tests de estructura, ARIA y retícula |
| Resumen de errores solo enumera etiquetas | No conoce elementos/foco ni mensaje por regla | `form-feedback.components.ts` | Mensajes específicos, enlaces, scroll/foco y actualización inmediata | Unitario y E2E de fecha inválida |
| Reglas de longitud/obligatoriedad no tienen una fuente auditable | Prisma, DTO y frontend evolucionan por separado | Prisma, DTO y formularios | Matriz de campos y script `forms:audit` | `FORM STANDARDIZATION PASSED` |
| Persona chilena puede guardarse sin RUT | Regla backend solo aplica a empresa | Clientes DTO/service/form | Política central CL y validación requerida para ambos tipos | Unit/integration/E2E RUT |
| Cliente chileno puede guardarse sin WhatsApp | Campo opcional en Prisma, DTO y formulario | Clientes | Exigir, normalizar y validar WhatsApp para CL | Unit/integration/E2E teléfono |
| Región/comuna no cubre Chile y vive en un componente | Catálogo geográfico incrustado | `client-form.component.ts` | Política/dataset central con dependencia país-región-comuna | Cambio de país y limpieza de dependencias |
| Se muestra “CRM” y “Lead” en español | Terminología técnica hardcodeada | Cliente e XLIFF | Eliminar eyebrow técnico y mapear Prospecto/Lead/Potencial | Escaneo de texto y builds localizados |
| Acciones están acopladas al modal | Definiciones privadas en `CommandPaletteComponent` | Command palette | Crear `ActionRegistry` tipado y matriz de permisos/rutas | Unitario por acción y E2E RBAC |
| No hay busy global concurrente | Cada componente administra loading local | Web transversal | `GlobalBusyService` con contador y demora 150 ms | Concurrencia, error, cancelación y timeout |
| Sesión permanece indefinida con token renovable | No existe política de actividad | Auth/layout web | `SessionIdleService`, warning 240 s, logout 300 s y BroadcastChannel | Fake timers, cross-tab y E2E |
| `NONE` puede coexistir conceptualmente con valor | Invariante repartida entre UI/DTO/cálculo | Cotizaciones | Contrato estricto y control deshabilitado que limpia valor | Casos NONE/PERCENTAGE/FIXED |
| Descuento global no tiene distribución explícita | Porcentaje calculado por línea de forma independiente | `@kaklen/shared` | Asignación proporcional y residuo determinista | Matriz 0/5/100 %, fijo, IVA y CLP |
| Vigencia inválida no ofrece navegación directa al campo | Validación general sin summary enlazable | Quotation form/service | Validador de rango y mensaje específico con foco | Unitario e E2E |
| PDF incompleto y no paginado | Generador manual simple sin ViewModel | `quotations/pdf.ts` | `QuotationDocumentService` + ViewModel + render multipágina | Magic bytes, contenido, páginas, notas largas e i18n |
| Correo comercial continúa disponible | No hay feature flag separado | Quotation controller/UI/config | `AUTH_EMAIL_ENABLED=true`, `COMMERCIAL_EMAIL_ENABLED=false` | Config unit, endpoint/UI ocultos, mail security intacto |
| No existe centro persistente de notificaciones | Toasts son efímeros y no hay modelo | Nuevo módulo notifications | Modelo multiempresa, endpoints, contador, lectura y navegación | Tenant isolation, cross-tab y E2E |
| No existe portal seguro para el cliente | Cotización solo accesible con JWT administrativo | Nuevo módulo portal | Token aleatorio hasheado, expirable/revocable y vista pública | Hash, expiry, revocation, obsolete version y isolation |
| No existe solicitud de cambios | Estados e historial no contemplan flujo público | Quotations/portal | `CHANGES_REQUESTED`, comentario obligatorio, historial y versión | Integración y E2E de versionado |
| No existe flujo WhatsApp | Sin servicio ni registro de estados | Nuevo módulo WhatsApp | Modo manual real (`wa.me`) y contrato de proveedor | URL segura, estado prepared y ausencia de datos sensibles |
| No existe pago local verificable | Sin gateway ni modelos | Nuevo módulo payments | `PaymentGateway` + sandbox + webhook firmado/idempotente | Monto/moneda/firma/duplicado/refund/tenant |
| No existe conversión opcional a proveedor | No hay perfil ni consentimiento | Nuevo módulo providers | Perfil independiente, prefill consentido y analytics sin PII | Recomendación contextual y flujo E2E |
| Los viewports requeridos no forman parte del gate | Accesibilidad cubre un subconjunto | E2E/design system | Matriz responsive 320–1920 y detector de overflow | Playwright por viewport y documentación |
| Nuevas superficies carecen de traducción | Funcionalidad aún ausente | XLIFF `es/en/pt-BR` | Extraer y traducir cada texto visible y mapeo de enums/acciones | Builds, escaneo de claves/enums y E2E locales |
| Gate no cubre los nuevos contratos | Lista de checks anterior a la estabilización | `scripts/quality-gate.mjs` | Incorporar forms, acciones, menú, dinero, PDF, portal, pagos, notificaciones, idle y responsive | Salida única `QUALITY GATE PASSED` |

## Criterio de cierre

Cada fila anterior debe quedar asociada a código ejecutable, documentación no redundante y al menos una comprobación automatizada. La cobertura final no puede quedar por debajo de este baseline y el push solo puede realizarse después del Quality Gate completo.
