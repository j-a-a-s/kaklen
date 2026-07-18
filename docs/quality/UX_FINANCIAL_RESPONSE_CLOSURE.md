# Cierre UX, financiero y respuesta del cliente

Fecha de cierre: 2026-07-18
Rama: main
SHA inicial: 62038d16d84dc0ed68e7c2915c5337b6af3c7a86

Este documento registra la reproduccion, causa raiz, correccion y evidencia de
regresion del sprint. La evidencia integral queda materializada por
pnpm quality:gate en artifacts/quality-gate.json y artifacts/quality-gate.log;
el cierre solo es valido cuando el artefacto termina con status passed.

## Login y semantica de campos

| Aspecto | Cierre |
| --- | --- |
| Defecto | El email de login se mostraba como opcional aunque el validador personalizado devolvia required. |
| Reproduccion | Abrir /es/login, dejar email vacio y comparar la etiqueta con el error de obligatoriedad. |
| Causa raiz | El componente de campo solo reconoce Validators.required para metadata visual; emailValidator(true) escondia la regla dentro de un validador personalizado. |
| Solucion | Todos los emails obligatorios declaran Validators.required y emailValidator() por separado. El auditor detecta validadores personalizados obligatorios sin metadata explicita. |
| Regresion | login.component.spec.ts, forms-audit.test.mjs y Playwright verifican etiqueta, aria-required, aria-invalid, vacio, formato invalido y valor valido en es, en y pt-BR. |

## Reticula de formularios

| Aspecto | Cierre |
| --- | --- |
| Defecto | Selects, labels y ayudas largas podian ensanchar una columna e invadir el control contiguo. |
| Reproduccion | Abrir una cotizacion, agregar un producto con nombre largo y reducir el viewport o aumentar la escala. |
| Causa raiz | Las columnas no usaban minmax(0, 1fr) y los descendientes no tenian una politica comun de contencion. |
| Solucion | La reticula compartida usa dos columnas flexibles contenidas, hijos con min-width 0, controles al 100 % y una columna hasta 768 px. Las superficies financieras usan filas y resumenes con dimensiones estables. |
| Regresion | ux-financial-closure.test.mjs inspecciona el contrato CSS y Playwright comprueba overflow, colisiones y siete viewports, incluidas escalas equivalentes de 125 %, 150 % y 200 %. |

## Regla financiera unica

El calculo compartido usa enteros escalados y el siguiente orden:

1. subtotal de linea = cantidad por precio unitario.
2. Se resta el descuento efectivo de linea.
3. El descuento global se calcula sobre el neto restante de todas las lineas.
4. El total global se reparte proporcionalmente por mayor residuo y orden de origen.
5. El impuesto se redondea por linea con la precision de la moneda.
6. Los agregados son exclusivamente la suma de los resultados por linea.

Una linea PERCENTAGE o FIXED con valor cero sigue participando del descuento
global. La interfaz explica: "El descuento global se aplica al subtotal despues
de los descuentos por linea."

### Fixtures CLP exactos

| Caso | Subtotal | Desc. linea | Desc. global | Base | IVA | Total | Totales por linea |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| A, sin descuentos | 1413100 | 0 | 0 | 1413100 | 268489 | 1681589 | 499800, 618800, 562989 |
| B, global 1 % | 1413100 | 0 | 14131 | 1398969 | 265804 | 1664773 | 494802, 612612, 557359 |
| C, linea 2 al 5 % y global 1 % | 1413100 | 26000 | 13871 | 1373229 | 260913 | 1634142 | 494802, 581981, 557359 |

Los impuestos por linea del caso B son 79002, 97812 y 88990; los del caso C son
79002, 92921 y 88990. Los mismos fixtures se verifican en shared, API y E2E,
incluyendo portal, pago sandbox y PDF.

### Invariantes

assertQuotationMoneyInvariants comprueba por linea y agregado:

- discountTotal = lineDiscountTotal + globalDiscountTotal;
- taxableBase = subtotal - discountTotal;
- total = taxableBase + taxTotal;
- cada agregado es la suma exacta de sus lineas;
- el total es la suma exacta de los totales finales por linea.

calculateQuotationMoney ejecuta las invariantes antes de devolver datos para
persistencia. PDF, portal y pagos recalculan y comparan contra cada monto
persistido; una diferencia de una unidad menor produce
QUOTATION_MONEY_MISMATCH y bloquea la operacion.

## Resumen multi-moneda

La API devuelve `baseCurrencyApprovedAmount` y `approvedAmounts`, donde cada
grupo incluye `currency`, `amount` y `quotationCount`. Prisma agrupa solo
cotizaciones aprobadas por moneda y organizacion. La moneda base aparece primero
y las restantes se ordenan alfabeticamente; no existe conversion implicita ni
suma de monedas incompatibles.

El fixture de regresion usa CLP 100000, CLP 50000, USD 500.25, EUR 100.50 y BRL
800.00. La respuesta exacta conserva CLP 150000 con dos cotizaciones, seguido de
BRL 800.00, EUR 100.50 y USD 500.25 con una cotizacion cada uno. El KPI muestra
`Aprobado en moneda base`, `$150.000 CLP` y una lista independiente bajo
`Otros importes aprobados`. El E2E comprueba estos valores en API y en la vista,
por lo que una suma consolidada de 151400.75 no puede presentarse como importe.

## Respuesta del cliente

| Superficie | Implementacion | Regresion |
| --- | --- | --- |
| Endpoint | GET /api/organizations/:organizationId/quotations/:quotationId/change-requests, protegido por quotations.read, valida tenant y devuelve versiones e items mapeados de mas reciente a mas antiguo. | Servicio y controller prueban permiso, orden, snapshot y rechazo cross-tenant. |
| Vendedor | La seccion #change-requests muestra banner, comentario completo escapado, saltos, fecha, version, items, estado sin items y accion Crear nueva version. Cotizacion, historial y solicitudes cargan en paralelo. | Playwright envia el comentario exacto y comprueba todos los datos en el detalle; pruebas Angular cubren carga, permiso y comentario con HTML literal. |
| Notificacion | Se persiste un extracto sin HTML de hasta 120 caracteres y el deep link termina en #change-requests. La ruta desplaza y resalta la seccion mediante una animacion temporal, incluso si Angular reutiliza el componente. | Specs de portal y centro de notificaciones validan sanitizacion, contenido, lectura y ruta; Angular prueba la llegada posterior del fragmento. |
| Historial | Conserva el evento general; QuotationChangeRequest sigue siendo la unica fuente del comentario completo. | Integracion comprueba que no se duplica el contenido comercial en historial. |

## Documento PDF

El documento incrusta apps/web/public/brand/logo-kaklen.png mediante una ruta
portable. El fallback solo esta permitido en desarrollo; CI y produccion fallan
si el asset no existe. El Dockerfile incorpora los assets de marca.

La tabla define columnas para codigo, producto o servicio, cantidad y precio.
Debajo de cada item incorpora filas rotuladas para subtotal neto, descuento por
linea, descuento global asignado, descuento total, base imponible, IVA y total
de linea con IVA incluido. El renderer mide glifos, envuelve por ancho real,
toma la altura maxima de cada fila y mueve la fila completa a una nueva pagina
cuando no cabe. Cada pagina repite logo, encabezado de documento y encabezado de
tabla. No se aplica ellipsis a datos comerciales.

Los tests cubren 1, 20 y 75 lineas, texto y contactos largos, varias paginas,
logo por pagina, encabezados repetidos, filas indivisibles, limites de pagina,
CLP, USD y etiquetas es/en/pt-BR. El resumen muestra exactamente subtotal neto,
descuento por linea, descuento global, descuento total, base imponible, IVA y
total.

## Precision CLP

- CLP usa cero decimales, inputmode numeric y step 1.
- USD, EUR y BRL usan dos decimales, inputmode decimal y step 0.01.
- 1000.00 en CLP se normaliza a 1000 al perder foco.
- 1000.50 permanece visible, marca error y nunca se redondea ni persiste.
- Backend acepta fracciones compuestas solo por ceros y rechaza valor economico
  fraccionario con CLP_FRACTION_NOT_ALLOWED.
- Otras precisiones invalidas usan MONEY_PRECISION_NOT_ALLOWED.
- Los contratos frontend transportan montos decimales sin conversiones float.

La directiva compartida se usa en catalogo, filtros de precio, cotizacion,
presupuesto de evento y precio referencial del perfil publico. Los recursos
editan cantidad, no costo; pagos y reembolsos no exponen montos editables.

## Evidencia automatizada

Pruebas focales ejecutadas durante el desarrollo antes del gate final:

- calculo compartido: 15 tests;
- cotizaciones, portal y PDF en API: 75 tests;
- componentes Angular focales: 16 tests;
- auditoria UX y paridad PDF focal: 9 tests;
- TypeScript estricto de API y frontend.

La validacion final se ejecuta una sola vez con pnpm quality:gate. El artefacto
debe contener migraciones, demo, precision monetaria en DB, auditoria de
formularios, paridad financiera PDF, lint, tests con cobertura, build, los tres
locales, Mailpit, E2E, accesibilidad, Docker y scorecard. La salida valida debe
incluir:

- MIGRATION VERIFICATION PASSED;
- CLP MONEY PRECISION PASSED;
- FORM STANDARDIZATION PASSED;
- PDF MONEY PARITY PASSED;
- SCORECARD CURRENT;
- QUALITY GATE PASSED.
