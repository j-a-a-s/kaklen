# Matriz completa de pruebas

| Control | Unitario/integración | E2E o comando | Resultado requerido |
| --- | --- | --- | --- |
| Botones, tooltip y menú | specs shared UI/action menu | assisted journey | foco, lifecycle, una acción |
| Formularios y ARIA | validators, feedback, directive, 13 negativas AST | `pnpm forms:audit` | 25 forms/137 controls |
| Política Chile | shared + clients service | creación UI/API | RUT y WhatsApp obligatorios |
| Centro de acciones | ActionRegistry y palette specs | assisted journey | rutas, permisos y teclado |
| Busy global | service/interceptor specs | navegación/PDF/pago | contador sin bloqueo residual |
| Idle cross-tab | fake timers/BroadcastChannel | logout E2E | warning 240 s, cierre 300 s |
| Dinero | shared money + quotation API | cotización E2E | totales exactos |
| PDF | cálculo exacto/ViewModel/renderer/controller | `pnpm pdf:verify-money` y descarga real | paridad persistida, `%PDF`, paginado |
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
| Migraciones limpias | núcleo del verificador | `pnpm db:verify:migrations` | 18 migraciones, schema, índices, seed y cero drift |
| Arquitectura/seguridad | static checks | quality/release gates | sin secretos ni límites rotos |

## Gate final

`pnpm quality:gate` resuelve un único grafo, ejecuta cada key una vez y falla al primer control requerido. Tests API generan cobertura en su única ejecución; i18n, E2E y accesibilidad reutilizan builds/evidencia ya validados. `quality:gate:ci`, `release:check` y `release:check:strict` seleccionan nodos del mismo grafo y nunca se llaman entre sí. El único cierre válido es `QUALITY GATE PASSED`.
