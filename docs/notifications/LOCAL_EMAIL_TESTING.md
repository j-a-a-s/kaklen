# Local Email Testing

## Configuration

When the Nest API runs directly on macOS, use:

```bash
MAIL_FROM="Kaklen <no-reply@kaklen.local>"
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_USER=
MAIL_PASSWORD=
APP_PUBLIC_URL=http://localhost:4200
EMAIL_VERIFICATION_EXPIRES_MINUTES=1440
PASSWORD_RESET_EXPIRES_MINUTES=30
```

When the API runs inside Docker, set `MAIL_HOST=mailpit`. The hostname is explicit because `localhost` inside the API container points back to that container, not to Mailpit.

## Start And Verify

`pnpm dev:full:i18n` ensures PostgreSQL, Redis, Mailpit SMTP, Mailpit web, Nest, and the three localized Angular builds are available. Verify SMTP separately with:

```bash
pnpm mail:verify
```

Success is reported as:

```text
MAIL SMTP READY
Host: localhost
Port: 1025
Secure: false
```

The command exits with code 1 and `MAIL SMTP UNAVAILABLE` when configuration, connection, authentication, or timeout checks fail. It never prints SMTP credentials.

`/api/health/ready` intentionally remains a database readiness check. An SMTP outage must not remove the complete API from service; mail readiness is observable through `pnpm mail:verify`, structured delivery logs, and the release and quality gates.

## Browser Flows

### Email Verification

1. Open `http://localhost:4200/es/register`.
2. Create a disposable account and confirm that the page stays unauthenticated.
3. Open Mailpit and inspect the `email_verification` message.
4. Follow the localized confirmation link.
5. Return to Login and sign in manually.

Resend creates a new message and revokes the previous link. A pending account does not receive password recovery mail.

### Password Recovery

1. Open `http://localhost:4200/es/login`.
2. Select `¿Olvidaste tu contraseña?`.
3. Submit `empresa.angela@demo.kaklen.local`.
4. Wait for `[mail:sent]` in the API terminal.
5. Open `http://localhost:8025`.
6. Open the message, follow its localized link, and choose a new password.

An accepted delivery includes a structured entry similar to:

```text
[mail:sent] {"event":"mail.sent","result":"success","mailType":"password_reset","recipient":"empresa.angela@demo.kaklen.local","locale":"es","messageId":"<id@kaklen.local>","accepted":["empresa.angela@demo.kaklen.local"],"rejected":[],"timestamp":"..."}
```

The browser always receives the same generic response for active, inactive, missing, rate-limited, and SMTP-failed requests. Operational truth belongs to the internal log, `PasswordResetToken.sentAt`, audit data, and Mailpit.

## Troubleshooting

- `ECONNREFUSED`: confirm Docker is running and Mailpit exposes port 1025.
- `ETIMEDOUT`: check the SMTP hostname and network path.
- Recipient rejected: inspect Mailpit or provider recipient policy; no usable reset token remains.
- Empty Mailpit inbox with a generic browser response: run `pnpm mail:verify`, inspect `[mail:failed]`, and confirm the account is active and not silently rate-limited.
- API in Docker cannot reach `localhost`: set `MAIL_HOST=mailpit`.

Logs may contain the destination email and provider `messageId`. They must never contain the reset token, full reset URL, password, email body, or SMTP credentials.
