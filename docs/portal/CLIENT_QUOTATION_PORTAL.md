# Portal seguro de cotizaciones

## Acceso

La ruta pública es `/{locale}/p/quotations/:publicToken`. El token usa entropía criptográfica, se persiste únicamente como SHA-256, tiene expiración, puede revocarse y queda unido a una cotización y versión. La respuesta usa `Referrer-Policy: no-referrer` y `Cache-Control: no-store`; no expone IDs administrativos.

## Flujo

1. Un usuario con `quotations.send` crea el enlace; una cotización borrador pasa a enviada.
2. La primera visualización genera una notificación interna, sin duplicarla por recargas.
3. El cliente puede seleccionar líneas y solicitar cambios con comentario.
4. La versión queda `CHANGES_REQUESTED`; el operador crea una versión nueva sin sobrescribir la anterior.
5. Versiones anteriores siguen legibles, muestran banner y no admiten acciones.
6. La versión vigente permite aprobar e iniciar un pago sandbox idempotente.
7. Tras aprobación o pago aparece la invitación opcional para perfil profesional.

Servicios y controladores verifican token, vencimiento, revocación, versión vigente, estado y rangos de ítems. Los tests cubren hash, token inválido, enlace vencido, solicitud, historial, versión obsoleta, aprobación, notificaciones y flujo E2E.
