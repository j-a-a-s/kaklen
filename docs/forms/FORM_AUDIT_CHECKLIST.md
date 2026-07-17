# Auditoría de formularios

Fecha de cierre: 2026-07-17

El comando `pnpm forms:audit` inspecciona templates Angular y falla ante controles reactivos sin contrato HTML, campos obligatorios sin indicador, email/teléfono con tipo incorrecto, ausencia de `maxlength`, formularios de datos sin resumen o controles sin estado ARIA. El resultado esperado es `FORM STANDARDIZATION PASSED`.

## Superficies verificadas

| Área | Formulario | Estructura compartida | Validación visible | Evidencia automatizada |
| --- | --- | --- | --- | --- |
| Auth | Login | Label, control, error | Email, contraseña y error de servidor | `login.component.spec.ts`, `forms:audit` |
| Auth | Registro | Label, indicador, error | Nombres, email y contraseña | `auth.e2e-spec.ts`, `forms:audit` |
| Auth | Reenvío de confirmación | Label, error | Email | `email-verification.e2e-spec.ts` |
| Auth | Recuperar contraseña | Label, error | Email | `password-recovery.e2e-spec.ts` |
| Auth | Nueva contraseña | Summary, labels y errores | Token, contraseña y confirmación | `password-recovery.e2e-spec.ts` |
| Auth | Aceptar invitación | Summary y errores | Nombre y contraseña | `forms:audit` |
| Organizaciones | Nueva organización | Summary, required/optional | Nombre, país, RUT y formato | `organizations.service.spec.ts`, `forms:audit` |
| Organizaciones | Configuración | Summary, required/optional | Identidad, contacto y región | `organizations.service.spec.ts`, `forms:audit` |
| Organizaciones | Invitar miembro | Summary y required | Email y rol | `organization-members.component` audit |
| Clientes | Crear cliente | Wizard, summary, helper y errores | RUT, WhatsApp, email, región/comuna | `clients.service.spec.ts`, `assisted-product.spec.mjs` |
| Clientes | Editar cliente | Summary, helper y errores | Política por país completa | `clients.service.spec.ts`, `forms:audit` |
| Clientes | Nueva interacción | Required/optional y errores | Tipo, asunto, fecha y descripción | `forms:audit` |
| Clientes | Filtros | Semántica `role=search` | Texto, tipo y estado | `forms:audit` |
| Catálogo | Crear producto/servicio | Summary y field grid | Código, nombre, unidad, precios e IVA | `catalog.service.spec.ts`, `forms:audit` |
| Catálogo | Editar producto/servicio | Summary y field grid | Reglas de producto/servicio | `catalog.service.spec.ts`, `forms:audit` |
| Catálogo | Filtros | Semántica `role=search` | Texto, tipo, estado y rango de precio | `forms:audit` |
| Cotizaciones | Crear/editar | Wizard, summary y grid estable | Cliente, fechas, ítems, descuentos y términos | `quotations.service.spec.ts`, `assisted-product.spec.mjs` |
| Cotizaciones | Filtros | Semántica `role=search` | Texto, estado, cliente y fechas | `forms:audit` |
| Cotizaciones | Correo comercial | Contrato preservado tras flag | Destinatario, asunto y mensaje | `quotation-email-dialog`, oculto por configuración |
| Eventos | Crear/editar | Wizard, summary y field grid | Nombre, cliente, fechas y ubicación | `events.service.spec.ts`, `forms:audit` |
| Eventos | Tarea | Summary y errores | Título, prioridad, estado y vencimiento | `forms:audit` |
| Eventos | Participante | Summary y errores | Rol e identidad | `forms:audit` |
| Eventos | Recurso/cronograma | Summary y errores | Cantidad, unidad y rango horario | `forms:audit` |
| Portal | Solicitar cambios | Summary y error específico | Comentario y líneas relacionadas | `public-quotation.component.spec.ts`, portal API tests |
| Portal | Perfil profesional | Summary, consentimiento y errores | Categoría, descripción, WhatsApp, país y precio | `public-quotation.component.spec.ts`, provider API tests |

## Comportamiento común

- `FormControlA11yDirective` deriva `aria-required` desde validators y `aria-invalid` desde estado/touch.
- `FormErrorSummaryComponent` enumera campos concretos y enfoca el control seleccionado.
- `FieldErrorComponent` ocupa el espacio del helper para conservar la retícula.
- `CountryBusinessPolicy` comparte reglas de RUT, WhatsApp, moneda e IVA entre API y web.
- En móvil la retícula pasa a una columna y no crea overflow horizontal.
- El auditor cubre 25 formularios y 101 controles reactivos.
