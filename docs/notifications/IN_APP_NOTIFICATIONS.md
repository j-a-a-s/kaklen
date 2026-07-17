# Notificaciones internas

Las notificaciones son registros por organización y usuario. Los tipos cubren visualización, cambios, aprobación, pago iniciado/confirmado/fallido, enlace vencido, versión nueva y evento próximo.

## Contrato

- `GET /api/organizations/:organizationId/notifications`
- `GET .../notifications/unread-count`
- `PATCH .../notifications/:notificationId/read`
- `PATCH .../notifications/read-all`

Cada operación requiere JWT, membresía activa y `organization.read`. El servicio selecciona únicamente miembros activos del tenant. La UI muestra contador, lista localizada, navegación al recurso, lectura individual y total. Un canal entre pestañas actualiza el estado sin mezclar organizaciones.

Los textos persistidos son fallback técnico; la UI traduce según `type`, no depende del literal backend. La suite API cubre audiencia, aislamiento, lectura idempotente y no encontrado; la suite web cubre activación y cache; el E2E verifica eventos de portal y pago.
