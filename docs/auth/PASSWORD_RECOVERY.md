# Password Recovery

## Flow

1. The user opens `/:locale/forgot-password` from Login and submits an email address.
2. `POST /api/auth/forgot-password` normalizes the address and always returns the same public message.
3. For an active account, the API revokes valid tokens, creates 48 random bytes, and saves only the SHA-256 hash.
4. SMTP sends an `es`, `en`, or `pt-BR` template with a link built from `APP_PUBLIC_URL`.
5. `/:locale/reset-password?token=...` submits the new password to `POST /api/auth/reset-password`.
6. One transaction consumes the token, replaces the Argon2id hash, revokes refresh tokens, increments `User.authVersion`, and writes an audit event.
7. The user returns to Login manually. Kaklen does not sign in automatically.

## Security Controls

- URL-safe random single-use token; it is neither a JWT nor a refresh token.
- Unique SHA-256 hash in PostgreSQL and lookup by hash.
- Default expiration of 30 minutes.
- Equivalent response for existing, missing, and inactive accounts.
- Silent request limits by IP and email; reset limits by IP and token.
- Optional IP and user-agent values persisted as HMAC, never plaintext.
- No client-provided redirect URL; the public origin comes from the environment.
- No token, password, or full email address in logs or audit metadata.
- Immediate access-token invalidation through `authVersion` and refresh-token revocation.

The keyed limiter is process-local. Before horizontally scaling the API, production must use a shared rate-limit store.

## Environment

```bash
APP_PUBLIC_URL=http://localhost:4200
PASSWORD_RESET_EXPIRES_MINUTES=30
MAIL_FROM="Kaklen <no-reply@kaklen.local>"
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
MAIL_USER=
MAIL_PASSWORD=
```

`MAIL_USER` and `MAIL_PASSWORD` must be configured together. `APP_PUBLIC_URL` accepts only HTTP or HTTPS and must point to the real public origin.

## Local Development

Run:

```bash
pnpm dev:full:i18n
```

The web application is available at `http://localhost:4200/es/login`, and Mailpit is available at `http://localhost:8025`. Local email never leaves the machine.

## Staging

- Set `APP_PUBLIC_URL` to the real HTTPS domain.
- Use a dedicated staging SMTP account.
- Verify sender SPF/DKIM and localized links in all three languages.
- Run password recovery E2E with disposable accounts.

## Production

- Inject SMTP credentials from the secret manager, never a committed file.
- Set `MAIL_SECURE=true` when the provider requires direct TLS.
- Monitor delivery failures without recording complete recipients or tokens.
- Configure a shared rate-limit store before running more than one API replica.

## Tests

- Jest covers token states, password policy, hashing, audit, rate limiting, and session invalidation.
- Karma covers Angular forms, loading, messages, strength, and navigation.
- Playwright reads Mailpit, extracts the real link, and verifies old password, new password, reuse, and prior-session rejection.
- `pnpm quality:gate` runs the recovery contract, i18n, secret scan, and E2E.
