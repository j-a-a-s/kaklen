# Seguridad del canal público de leads

## Alcance

`apps/marketing` envía solicitudes exclusivamente a `POST /api/leads`. El navegador no accede a
PostgreSQL, SMTP, Redis ni al proveedor de WhatsApp. Este documento registra el modelo de amenazas y
las pruebas de abuso ejecutables del canal.

## Datos y límites de confianza

- Datos comerciales: nombre, correo, teléfono, empresa, cargo, interés y mensaje.
- Consentimiento: versión de texto, fecha, HMAC de IP y HMAC de user-agent.
- Atribución minimizada: UTM acotado, ruta relativa y referrer sin credenciales, query ni fragmento.
- Nunca se persisten IP o user-agent en texto claro.
- Los eventos de auditoría no se eliminan en cascada con el lead.

## Controles

- DTO estricto con `whitelist`, `forbidNonWhitelisted`, límites de longitud y caracteres de control.
- Honeypot y límite distribuido de cinco solicitudes por minuto por IP.
- Normalización E.164 con la validación compartida de Kokecore.
- Consentimiento de privacidad obligatorio y consentimiento de WhatsApp independiente.
- HMAC con el secreto operacional existente; no se reutilizan identificadores en respuestas.
- Escape completo de HTML y neutralización de saltos de línea en asuntos de correo.
- Errores de proveedor reducidos a códigos seguros; mensajes o credenciales del proveedor no se guardan.
- El frontend traduce códigos permitidos y nunca renderiza el mensaje literal del backend.
- Timeout, respuesta JSON acotada, `credentials: omit`, `no-store`, CSP y cabeceras anti-framing.
- JSON-LD serializado sin secuencias que puedan cerrar el elemento `script`.
- El modo manual de WhatsApp no declara una entrega automática.

## Pruebas de hacking ético

Las pruebas automatizadas locales cubren XSS almacenado en correo/JSON-LD, inyección de cabeceras,
overposting, prototype pollution, honeypot, metadatos hostiles, URLs no permitidas, abuso de rate
limit, respuestas backend manipuladas, timeout y filtración de errores del proveedor. No realizan
tráfico contra terceros ni usan datos reales.

## Riesgos residuales

- La retención y eliminación de leads debe materializarse en una política operativa antes de producción.
- La integración real de WhatsApp requiere revisión contractual, credenciales en el secret store y E2E
  contra el proveedor autorizado.
- El endpoint público debe quedar detrás de WAF, métricas y alertas en staging/producción.
- CSP mantiene `unsafe-inline` para el bootstrap de Next.js; cualquier futura entrada HTML requiere la
  misma revisión de escape y una migración a nonces si se incorpora contenido dinámico no confiable.
- Falta una interfaz administrativa para gestionar leads; hasta entonces, el acceso operativo debe
  limitarse a personal autorizado y consultas auditadas.
