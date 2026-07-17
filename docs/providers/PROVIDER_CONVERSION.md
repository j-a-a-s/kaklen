# Conversión opcional a proveedor

La invitación aparece solamente cuando la cotización vigente fue aprobada o pagada. El texto es general y no infiere una profesión. Cerrar o ignorar la invitación no afecta cotización, pago ni acceso al portal.

## Flujo

1. La visualización registra `RECOMMENDATION_SHOWN` sin PII.
2. El cliente abre el formulario voluntariamente.
3. Solo tras marcar consentimiento se precargan país y WhatsApp ya confirmados.
4. Categoría, descripción, ubicación, precio y portfolio se validan.
5. El perfil se guarda `IN_REVIEW`; no se publica automáticamente.
6. Analytics registra inicio y finalización sin email, teléfono, nombre ni contenido del perfil.
7. Un usuario autorizado puede publicar o archivar durante revisión.

La unicidad `organizationId + sourceClientId` evita perfiles duplicados por reintentos. Los tests cubren elegibilidad, consentimiento, teléfono por país, upsert, analytics sin PII y confirmación visible en portal.
