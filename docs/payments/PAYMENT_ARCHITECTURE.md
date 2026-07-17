# Arquitectura de pagos

## Límite actual

La implementación funcional es `SandboxPaymentGateway` para desarrollo y E2E. No procesa dinero real ni representa una integración productiva con Transbank, Mercado Pago u otro adquirente. La API rechaza creación y confirmación sandbox cuando `NODE_ENV=production`.

## Contrato de gateway

`PaymentGateway` define creación de intención, consulta, webhook, validación de firma, cancelación y reembolso. `Payment`, `PaymentAttempt`, `PaymentWebhookEvent`, `PaymentRefund` y `PaymentReceipt` preservan lifecycle, auditoría e idempotencia por organización.

## Reglas

- El portal crea la intención con UUID idempotente y valida cotización vigente, monto y moneda.
- Un reintento con la misma clave reutiliza el pago y rota el token de checkout.
- El retorno del navegador no confirma nada; solo un webhook con firma válida cambia el estado final.
- `providerEventId` único evita aplicar dos veces el mismo evento, incluso bajo concurrencia.
- Un webhook con monto o moneda diferente se rechaza.
- `PAID` marca `quotation.paidAt`, crea un recibo y emite una notificación.
- Cancelación y reembolso autenticados exigen tenant y permisos de wallet.

`PAYMENT_GATEWAY=sandbox` y `PAYMENT_SANDBOX_SECRET` configuran el entorno local. La migración crea índices de tenant, estado, referencia e idempotencia. Tests unitarios, de servicio y E2E cubren firma, duplicados, carrera, mismatch, checkout y confirmación.

## Pendiente externo

Producción requiere seleccionar proveedor, contratar credenciales, implementar su adaptador, validar firma oficial, conciliación, observabilidad, manejo de secretos y certificación del adquirente.
