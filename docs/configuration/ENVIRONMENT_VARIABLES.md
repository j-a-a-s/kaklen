# Variables de entorno

`.env.example` es el contrato canónico para desarrollo local. Copia el archivo a
`.env`, modifica solo lo necesario y nunca versiones `.env` ni credenciales
reales.

## Persistencia e infraestructura

| Variable | Valor local | Propósito |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://kaklen:***@localhost:5432/kaklen_dev?schema=public` | Conexión Prisma; la contraseña completa solo vive en `.env.example` y `.env`. |
| `DATABASE_SSL` | `false` | Exige TLS para PostgreSQL cuando es `true`; producción también requiere `sslmode=require` en `DATABASE_URL`. |
| `POSTGRES_PORT` | `5432` | Puerto publicado por Docker Compose. |
| `REDIS_PORT` | `6379` | Puerto publicado de Redis. |
| `REDIS_URL` | `redis://localhost:6379` | Conexión para límites y colas. |
| `AWS_REGION` | `us-east-1` | Región del runtime AWS. |
| `AWS_S3_BUCKET` | `kaklen-local` | Bucket de archivos. |
| `AWS_S3_ENDPOINT` | vacío | Endpoint S3 compatible opcional. |
| `AWS_CLOUDFRONT_DOMAIN` | vacío | Dominio CDN opcional. |

## Aplicación y red

| Variable | Valor local | Propósito |
| --- | --- | --- |
| `PORT` | `3000` | Puerto de escucha de NestJS. |
| `API_PORT` | `3000` | Puerto que usan los orquestadores locales. |
| `WEB_PORT` | `4200` | Puerto de la web local. |
| `NODE_ENV` | `development` | Perfil de ejecución. |
| `APP_VERSION` | `0.1.0` | Versión visible en runtime config y health. |
| `COMMIT_SHA` | `local` | Revisión del build. |
| `BUILD_TIME` | vacío | Fecha ISO del build; se genera cuando corresponde. |
| `PUBLIC_API_BASE_URL` | `http://localhost:3000/api` | Base URL consumida por Angular. |
| `PUBLIC_APP_ENVIRONMENT` | `development` | Etiqueta pública del entorno web. |
| `APP_WEB_URL` | `http://localhost:4200` | Origen principal de la web. |
| `APP_PUBLIC_URL` | `http://localhost:4200` | URL usada en enlaces públicos. |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:4200` | Allow-list CORS, separada por comas. |
| `AUTH_ALLOWED_ORIGINS` | `http://localhost:4200` | Allow-list para refresh y logout. |
| `TRUST_PROXY` | `false` | Confía en proxy solo cuando la topología lo requiere. |
| `LOG_LEVEL` | `debug` | Nivel de logs estructurados. |
| `SWAGGER_ENABLED` | `true` | Habilita Swagger fuera de producción. |

## Autenticación y sesión

| Variable | Valor local | Propósito |
| --- | --- | --- |
| `JWT_ACCESS_SECRET` | placeholder local | Firma de access tokens. |
| `JWT_REFRESH_SECRET` | placeholder local | Derivación de refresh tokens. |
| `JWT_ACCESS_EXPIRES_SECONDS` | `900` | Vida del access token. |
| `JWT_REFRESH_EXPIRES_SECONDS` | `604800` | Vida del refresh token. |
| `COOKIE_SECURE` | `false` | Exige HTTPS para cookies cuando es `true`. |
| `RATE_LIMIT_HASH_SECRET` | placeholder local | HMAC de identificadores de rate limiting. |
| `PASSWORD_RESET_EXPIRES_MINUTES` | `30` | Vencimiento de recuperación. |
| `EMAIL_VERIFICATION_EXPIRES_MINUTES` | `1440` | Vencimiento de confirmación. |
| `ORGANIZATION_INVITATION_EXPIRES_SECONDS` | `259200` | Vencimiento de invitaciones. |
| `SESSION_IDLE_SECONDS` | `300` | Cierre por inactividad. |
| `SESSION_WARNING_SECONDS` | `240` | Momento de advertencia previa. |
| `AUTH_EMAIL_ENABLED` | `true` | Habilita correo transaccional de autenticación. |
| `COMMERCIAL_EMAIL_ENABLED` | `false` | Habilita correo comercial. |

Los secretos de producción deben ser independientes, aleatorios y cumplir la
validación descrita en [Security](../SECURITY.md). Los orígenes con cookies no
admiten wildcard.

## Correo local

| Variable | Valor local | Propósito |
| --- | --- | --- |
| `MAILPIT_SMTP_PORT` | `1025` | Puerto SMTP de Mailpit. |
| `MAILPIT_WEB_PORT` | `8025` | Interfaz web de Mailpit. |
| `MAIL_FROM` | `Kaklen <no-reply@kaklen.local>` | Remitente predeterminado. |
| `MAIL_HOST` | `localhost` | Host SMTP para la API ejecutada en el host. |
| `MAIL_PORT` | `1025` | Puerto SMTP. |
| `MAIL_SECURE` | `false` | TLS implícito SMTP. |
| `MAIL_USER` | vacío | Usuario SMTP opcional. |
| `MAIL_PASSWORD` | vacío | Contraseña SMTP opcional. |
| `MAIL_CONNECTION_TIMEOUT_MS` | `5000` | Timeout de conexión. |
| `MAIL_GREETING_TIMEOUT_MS` | `5000` | Timeout de saludo SMTP. |
| `MAIL_SOCKET_TIMEOUT_MS` | `10000` | Timeout del socket SMTP. |

Dentro de Docker, `MAIL_HOST` debe apuntar al nombre del servicio `mailpit`.

## Integraciones

| Variable | Valor local | Propósito |
| --- | --- | --- |
| `WHATSAPP_MODE` | `manual` | Selecciona el flujo de WhatsApp local. |
| `WHATSAPP_HASH_SECRET` | placeholder local | HMAC de datos operativos de WhatsApp. |
| `PAYMENT_GATEWAY` | `sandbox` | Selecciona el gateway configurado. |
| `PAYMENT_SANDBOX_SECRET` | placeholder local | Firma del sandbox de pagos. |

Las variables internas de CI y reutilización de artefactos no forman parte del
contrato de configuración manual; los scripts las establecen durante cada
pipeline.
