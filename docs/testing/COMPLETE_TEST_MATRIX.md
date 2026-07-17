# Matriz completa de pruebas

| Control | Unitario/integración | E2E o comando | Resultado requerido |
| --- | --- | --- | --- |
| Botones, tooltip y menú | specs shared UI/action menu | assisted journey | foco, lifecycle, una acción |
| Formularios y ARIA | validators, feedback, directive | `pnpm forms:audit` | 25 forms/101 controls |
| Política Chile | shared + clients service | creación UI/API | RUT y WhatsApp obligatorios |
| Centro de acciones | ActionRegistry y palette specs | assisted journey | rutas, permisos y teclado |
| Busy global | service/interceptor specs | navegación/PDF/pago | contador sin bloqueo residual |
| Idle cross-tab | fake timers/BroadcastChannel | logout E2E | warning 240 s, cierre 300 s |
| Dinero | shared money + quotation API | cotización E2E | totales exactos |
| PDF | ViewModel/renderer/controller | descarga real | `%PDF`, no vacío, paginado |
| Email seguridad | mail/auth integration | Mailpit E2E y `mail:verify` | verificación/reset entregados |
| Email comercial | feature flag/mail spec | assisted journey | UI oculta y servicio bloqueado |
| Portal | token + service specs | MVP E2E | vista, cambios, versión obsoleta |
| WhatsApp | service/provider contract | MVP E2E | `PREPARED`, URL y sin datos sensibles |
| Notificaciones | API/web service specs | MVP E2E | tenant, contador y eventos |
| Pagos | gateway/service specs | MVP E2E | firma, idempotencia, recibo |
| Proveedor | service/component specs | MVP E2E | elegibilidad, consentimiento, revisión |
| i18n | extract/sync/build checks | tres rutas localizadas | es/en/pt-BR sin keys visibles |
| Responsive | component CSS/specs | 7 viewports Playwright | cero overflow horizontal |
| Accesibilidad | componentes compartidos | `pnpm accessibility:test` | nombres, foco, teclado, landmarks |
| DB demo | dataset unit tests | `pnpm db:verify:demo` | tenant, RUT, WhatsApp e idempotencia |
| Arquitectura/seguridad | static checks | quality/release gates | sin secretos ni límites rotos |

## Gate final

`pnpm quality:gate` ejecuta arquitectura, quality scan, formularios, secretos, SMTP, contratos de producto, migraciones, auth, seed idempotente, lint, tests, cobertura, build, API, tres locales, servidor i18n, E2E, accesibilidad, release y restauración demo. El único cierre válido es `QUALITY GATE PASSED`.
