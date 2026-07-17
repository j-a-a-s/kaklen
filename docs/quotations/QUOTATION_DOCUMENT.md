# Documento profesional de cotización

`QuotationDocumentService` construye un `QuotationDocumentViewModel` único y lo entrega al renderer PDF nativo. Todos los montos provienen exclusivamente de `calculateQuotationMoney()`; el ViewModel no usa `Number`, `parseFloat`, `toFixed` ni aritmética monetaria nativa.

Antes de renderizar, el servicio compara en unidades menores los totales y cada línea contra los valores persistidos. Una diferencia de un centavo bloquea el documento con `QUOTATION_MONEY_MISMATCH`; nunca se corrigen datos silenciosamente ni se entrega un PDF contradictorio.

## Contenido y diseño

- Encabezado Kaklen y datos legales/contacto de la organización.
- Identidad, RUT, WhatsApp, email y dirección del cliente cuando existen.
- Número, versión, estado localizado, emisión, vigencia y ejecutivo.
- Tabla con código, descripción, cantidad, unidad, precio, descuento, impuesto y total.
- Totales separados para subtotal, descuentos, base, impuestos y total.
- Notas, términos, historial relevante, fecha de generación y `Página X de Y`.
- Encabezado repetido, filas no cortadas, texto seleccionable y metadata PDF.

El renderer calcula páginas antes de escribirlas, soporta cero o muchas líneas y divide texto largo con límites explícitos. El endpoint autenticado responde `application/pdf`, `%PDF`, nombre seguro y valida permiso/tenant. La descarga web usa blob, object URL y revocación del URL.

## Evidencia

`quotation-document.service.spec.ts` cubre cantidades de tres decimales, residuos, descuentos 5%/100%/fijo/porcentaje, líneas no elegibles, IVA 19%, exentos, CLP, USD, montos grandes, 75 líneas, multipágina y mismatch de una unidad menor. `pnpm pdf:verify-money` realiza además una verificación estructural negativa y termina con `PDF MONEY PARITY PASSED`. `quotations.controller.spec.ts` cubre headers y RBAC; `assisted-product.spec.mjs` descarga el archivo real y verifica `%PDF`.
