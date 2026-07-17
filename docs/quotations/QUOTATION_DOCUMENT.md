# Documento profesional de cotización

`QuotationDocumentService` construye un `QuotationDocumentViewModel` único y lo entrega al renderer PDF nativo. El modelo contiene organización, cliente, ejecutivo, cotización, líneas, totales, historial y locale.

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

`quotation-document.service.spec.ts` verifica ViewModel, locale, paginación, texto largo, magic bytes y contenido. `quotations.controller.spec.ts` cubre headers y RBAC. `assisted-product.spec.mjs` descarga el archivo real y verifica `%PDF`.
