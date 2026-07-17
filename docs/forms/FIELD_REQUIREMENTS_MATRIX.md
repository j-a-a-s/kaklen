# Matriz de requisitos de campos

Esta matriz alinea HTML, validators Angular, DTO, Prisma y reglas de dominio. `Req.` usa `Sí`, `No` o `Cond.`; `BD` indica el límite persistente relevante.

| Formulario | Campo | Req. | Tipo/formato | Límites y BD | Regla y validators | Mensaje/evidencia |
| --- | --- | --- | --- | --- | --- | --- |
| Login | email | Sí | email normalizado | 254 | `emailValidator`; DTO email | Correo válido; auth E2E |
| Login | password | Sí | password | 8-128 | required | Contraseña obligatoria; auth E2E |
| Registro | firstName | Sí | texto trim | 1-80 | required, max 80; DTO | Nombre obligatorio; auth E2E |
| Registro | lastName | Sí | texto trim | 1-80 | required, max 80; DTO | Apellido obligatorio; auth E2E |
| Registro | email | Sí | email lowercase | 254, único | email; DTO; índice único | Correo válido/duplicado; auth E2E |
| Registro/reset | password | Sí | password | 8-128 | complejidad DTO | Contraseña segura; auth tests |
| Organización | name | Sí | texto trim | 2-160 | required, max; DTO/BD | Nombre requerido; organization tests |
| Organización | legalName | No | texto trim | 160 | max; DTO/BD | Longitud máxima; forms audit |
| Organización | taxId | Cond. | RUT para CL | 40 | módulo 11; DTO/service | RUT válido; organization tests |
| Organización | address | No | texto trim | 240 | max; DTO/BD | Longitud máxima; forms audit |
| Organización | phone | No | teléfono internacional | 24 | `normalizeInternationalPhone` | Teléfono válido; organization tests |
| Organización | whatsapp | No | teléfono internacional | 24 | normalización por país | WhatsApp válido; organization tests |
| Organización | country | Sí | ISO soportado | 2 | enum de países admitidos | País requerido; DTO tests |
| Organización | currency | Sí | ISO 4217 | 3 | uppercase; default CLP | Moneda válida; DTO tests |
| Organización | timezone | Sí | zona IANA | 80 | lista configurada | Zona requerida; DTO tests |
| Organización | defaultLocale | Sí | es/en/pt-BR | 5 | allowlist backend | Idioma permitido; locale tests |
| Miembro | email | Sí | email | 254 | email validator; DTO | Correo válido; forms audit |
| Miembro | role | Sí | rol RBAC | enum | required; DTO | Rol obligatorio; forms audit |
| Cliente | type | Sí | NATURAL_PERSON/LEGAL_ENTITY | enum | required; DTO | Tipo requerido; client tests |
| Cliente | status | Sí | LEAD/ACTIVE/INACTIVE | enum | required; DTO | Estado requerido; client tests |
| Cliente | firstName/lastName | Cond. | texto trim | 80 cada uno | requeridos para persona | Nombre completo requerido; client tests |
| Cliente | legalName | Cond. | texto trim | 160 | requerido para empresa | Razón social requerida; client tests |
| Cliente | taxId | Cond. | RUT módulo 11 para CL | 40, único por organización | política país, normalización | RUT requerido/válido/duplicado; API y E2E |
| Cliente | email | No | email lowercase | 254 | formato si existe | Ejemplo `nombre@empresa.cl`; API y E2E |
| Cliente | phone | No | teléfono internacional | 40 | prefijo + normalización | Teléfono válido; validator tests |
| Cliente | whatsapp | Cond. | teléfono internacional | 40 | obligatorio para CL | WhatsApp requerido/válido; API y E2E |
| Cliente | region | No | catálogo por país | 120 | se limpia al cambiar país | Región compatible; UI audit |
| Cliente | city | No | comuna dependiente | 120 | depende de región | Comuna compatible; UI audit |
| Cliente | address | No | texto trim | 240 | max | Longitud máxima; forms audit |
| Cliente | notes | No | texto trim | 2000 | max | Longitud máxima; forms audit |
| Interacción | type | Sí | enum | enum | required; DTO | Tipo requerido; client tests |
| Interacción | subject | Sí | texto trim | 160 | required, max | Asunto requerido; forms audit |
| Interacción | description | No | texto trim | 2000 | max | Longitud máxima; forms audit |
| Catálogo | type | Sí | PRODUCT/SERVICE | enum | controla inventario | Tipo requerido; catalog tests |
| Catálogo | code | Sí | texto trim | 80, único por organización | required; DTO/índice | Código requerido/duplicado; catalog tests |
| Catálogo | sku | No | texto trim | 80 | max; índice | Longitud máxima; catalog tests |
| Catálogo | name | Sí | texto trim | 160 | required, max | Nombre requerido; catalog tests |
| Catálogo | description | No | texto trim | 2000 | max | Longitud máxima; forms audit |
| Catálogo | unit | Sí | texto trim | 40 | required, max | Unidad requerida; catalog tests |
| Catálogo | cost/price | Sí | decimal | 12,2; >= 0 | decimal validator; DTO/Prisma | Monto no negativo; money tests |
| Catálogo | taxPercent | Sí | decimal porcentaje | 5,2; 0-100 | decimal/rango | Impuesto válido; catalog tests |
| Cotización | clientId | Sí | UUID | FK | required; DTO, tenant | Cliente requerido; quotation tests |
| Cotización | issueDate | Sí | fecha ISO | date | required; DTO | Emisión requerida; quotation tests |
| Cotización | validUntil | Sí | fecha ISO | date | >= issueDate | Vigencia no anterior; API y UI tests |
| Cotización | currency | Sí | ISO 4217 | 3 | organización/default | Moneda requerida; DTO tests |
| Cotización | globalDiscountPercent | No | decimal | 5,2; 0-100 | cálculo compartido | Rango 0-100; money tests |
| Línea | quantity | Sí | decimal | 12,3; > 0 | cálculo compartido | Cantidad positiva; money tests |
| Línea | unitPrice | Sí | decimal | 14,2; >= 0 | cálculo compartido | Precio no negativo; money tests |
| Línea | discountType/value | Sí | NONE/PERCENTAGE/FIXED | 14,2 | NONE=0; %=0-100; fijo<=base | Descuento coherente; money/API tests |
| Línea | taxPercent | Sí | decimal | 5,2; 0-100 | cálculo compartido | Impuesto válido; money tests |
| Cotización | notes/terms | No | texto trim | 5000 cada uno | max; DTO/BD text | Longitud máxima; PDF tests |
| Evento | name | Sí | texto trim | 160 | required; DTO | Nombre requerido; event tests |
| Evento | startAt/endAt | Sí | fecha-hora ISO | datetime | endAt > startAt | Rango válido; event tests |
| Evento | clientId/quotationId | No | UUID tenant | FK | aislamiento organización | Recurso válido; event tests |
| Evento | location/address | No | texto trim | 240 | max | Longitud máxima; forms audit |
| Tarea | title | Sí | texto trim | 160 | required; DTO | Título requerido; event tests |
| Tarea | priority/status | Sí | enum | enum | transiciones permitidas | Estado válido; event tests |
| Portal cambios | comment | Sí | texto trim | 5-2000 | required; DTO | Comentario de 5 caracteres; portal tests |
| Portal cambios | itemIndexes | No | enteros únicos | máx. 100 | índice existente | Línea válida; portal tests |
| Pago | idempotencyKey | Sí | UUID | único por organización | DTO + índice | Reintento idempotente; payment tests |
| Pago | outcome | Sí | PAID/FAILED | sandbox | allowlist | Resultado válido; payment tests |
| Proveedor | consent | Sí | boolean true | timestamp | `requiredTrue` y `Equals(true)` | Consentimiento explícito; provider tests |
| Proveedor | category | Sí | texto trim | 2-80 | required; DTO/BD | Categoría requerida; provider tests |
| Proveedor | description | Sí | texto trim | 20-2000 | required; DTO/BD | Descripción mínima; provider tests |
| Proveedor | whatsapp | Sí | teléfono por país | 24 | política país | WhatsApp válido; provider tests |
| Proveedor | price | No | decimal | 14,2; >= 0 | decimal validator | Precio no negativo; provider tests |
| Proveedor | portfolioUrl | No | URL http/https | 500 | URL validator | URL válida; provider tests |

Todos los campos de datos de esta matriz se renderizan mediante `FormFieldComponent` y `FormControlA11yDirective`. El estado visual required/invalid y ARIA deriva del mismo `NgControl`; las reglas dinámicas se prueban en runtime. La verificación estructural AST se ejecuta con `pnpm forms:audit`; la coherencia de negocio se cubre en suites API, web y E2E.
