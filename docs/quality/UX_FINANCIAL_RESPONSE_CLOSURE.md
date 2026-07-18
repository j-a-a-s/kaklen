# Cierre UX, financiero y respuesta del cliente

Fecha de cierre: 2026-07-17
Rama: main
SHA inicial: 3d183a4381d50d4495e940705e2c3519419bbadd

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

La API devuelve baseCurrencyAmountApproved y amountApprovedByCurrency. El KPI
principal incluye unicamente cotizaciones en la moneda base de la organizacion;
CLP, USD, EUR y BRL restantes se muestran por separado. No existe conversion
implicita ni suma de monedas incompatibles.

## Respuesta del cliente

| Superficie | Implementacion | Regresion |
| --- | --- | --- |
| Endpoint | GET /api/organizations/:organizationId/quotations/:quotationId/change-requests, protegido por quotations.read, valida tenant y devuelve versiones e items mapeados de mas reciente a mas antiguo. | Servicio y controller prueban permiso, orden, snapshot y rechazo cross-tenant. |
| Vendedor | La seccion #change-requests muestra banner, comentario completo escapado, saltos, fecha, version, items y accion para nueva version. | Playwright envia el comentario exacto y comprueba todos los datos en el detalle. |
| Notificacion | Se persiste un extracto sin HTML de hasta 120 caracteres y el deep link termina en #change-requests. | Specs de portal y centro de notificaciones validan sanitizacion, contenido y ruta. |
| Historial | Conserva el evento general; QuotationChangeRequest sigue siendo la unica fuente del comentario completo. | Integracion comprueba que no se duplica el contenido comercial en historial. |

## Documento PDF

El documento incrusta apps/web/public/brand/logo-kaklen.png mediante una ruta
portable. El fallback solo esta permitido en desarrollo; CI y produccion fallan
si el asset no existe. El Dockerfile incorpora los assets de marca.

La tabla define columnas independientes para codigo, producto o servicio,
cantidad, precio, descuento, IVA y total. El renderer mide glifos, envuelve por
ancho real, toma la altura maxima de cada fila y mueve la fila completa a una
nueva pagina cuando no cabe. Cada pagina repite logo, encabezado de documento y
encabezado de tabla. No se aplica ellipsis a datos comerciales.

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

Pruebas focales ejecutadas durante el desarrollo:

- calculo compartido: 13 tests;
- servicios API relacionados: 87 tests;
- servicio de cotizaciones: 36 tests;
- componentes Angular focales: 11 tests;
- auditoria y estructura de formularios: 18 tests;
- servidor y rutas i18n: 10 tests;
- TypeScript estricto del frontend y comprobacion limpia del diff.

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
