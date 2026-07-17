# Flujo WhatsApp

`WhatsAppNotificationService` admite dos modos configurables.

## Manual local

Con `WHATSAPP_MODE=manual`, Kaklen crea un mensaje localizado, un enlace `wa.me` y un registro `PREPARED`. Esto significa que el aviso quedó preparado para que el usuario lo abra; no significa que WhatsApp lo haya enviado. El mensaje solo incluye una introducción y el URL seguro del portal, sin nombre, total ni detalle de líneas.

El destinatario se normaliza y se almacena como HMAC, no como teléfono legible. El enlace público debe existir, corresponder a la misma organización/cotización y seguir vigente.

## Proveedor futuro

`WhatsAppProvider` define el adaptador para envío real y callbacks `SENT`, `FAILED` y `OPENED`. El modo provider falla de forma explícita si no hay adaptador/credenciales. No existe en esta entrega una integración productiva con Meta u otro proveedor.

Variables: `WHATSAPP_MODE` y `WHATSAPP_HASH_SECRET`. La evidencia está en `whatsapp-notification.service.spec.ts` y el recorrido E2E del MVP.
