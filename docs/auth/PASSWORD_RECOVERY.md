# Password Recovery

## Flow

1. The user opens `/:locale/forgot-password` from Login and submits an email address.
2. `POST /api/auth/forgot-password` normalizes the address and always returns the same public message.
3. The endpoint enqueues the same BullMQ job type without querying account eligibility or waiting for SMTP.
4. A worker loads the account and, when eligible, revokes valid tokens, creates 48 random bytes, saves only the SHA-256 hash, and sends an `es`, `en`, or `pt-BR` template built from `APP_PUBLIC_URL`.
5. The token receives `sentAt` only after SMTP accepts the recipient and returns a `messageId`.
6. `/:locale/reset-password?token=...` submits the new password to `POST /api/auth/reset-password`.
7. One transaction consumes the token, replaces the Argon2id hash, revokes refresh tokens, increments `User.authVersion`, and writes an audit event.
8. The user returns to Login manually. Kaklen does not sign in automatically.

## Security Controls

- URL-safe random single-use token; it is neither a JWT nor a refresh token.
- Unique SHA-256 hash in PostgreSQL and lookup by hash.
- Default expiration of 30 minutes.
- Equivalent response for existing, missing, and inactive accounts.
- Silent request limits by IP and email; reset limits by IP and token.
- Optional IP and user-agent values persisted as HMAC, never plaintext.
- No client-provided redirect URL; the public origin comes from the environment.
- Delivery logs include only a recipient fingerprint and delivery counts, never the full email, token, complete reset URL, password, message body, or SMTP credentials.
- A failed or rejected SMTP delivery revokes the newly created token and leaves `sentAt` empty.
- Delivery uses at most three durable attempts with exponential backoff and limited failed-job retention.
- Immediate access-token invalidation through `authVersion` and refresh-token revocation.

Rate limits use a shared atomic Redis counter and HMAC-protected identifiers. Redis failure returns a stable 503 and never falls back to process memory.

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
MAIL_CONNECTION_TIMEOUT_MS=5000
MAIL_GREETING_TIMEOUT_MS=5000
MAIL_SOCKET_TIMEOUT_MS=10000
REDIS_URL=redis://localhost:6379
RATE_LIMIT_HASH_SECRET=local-rate-limit-hash-secret-change-me
```

`MAIL_USER` and `MAIL_PASSWORD` must be configured together. `APP_PUBLIC_URL` accepts only HTTP or HTTPS and must point to the real public origin.

## Local Development

Run:

```bash
pnpm dev:full:i18n
```

The web application is available at `http://localhost:4200/es/login`, and Mailpit is available at `http://localhost:8025`. Local email never leaves the machine.

Verify SMTP independently with `pnpm mail:verify`. Use `MAIL_HOST=localhost` when Nest runs on the host and `MAIL_HOST=mailpit` when Nest runs in Docker Compose.

## Staging

- Set `APP_PUBLIC_URL` to the real HTTPS domain.
- Use a dedicated staging SMTP account.
- Verify sender SPF/DKIM and localized links in all three languages.
- Run password recovery E2E with disposable accounts.

## Production

- Inject SMTP credentials from the secret manager, never a committed file.
- Set `MAIL_SECURE=true` when the provider requires direct TLS.
- Monitor delivery failures without recording complete recipients or tokens.
- Use a durable production Redis deployment shared by every API replica and worker.

## Tests

- Jest covers token states, password policy, hashing, audit, rate limiting, and session invalidation.
- Karma covers Angular forms, loading, messages, strength, and navigation.
- Playwright reads Mailpit, extracts the real link, and verifies old password, new password, reuse, and prior-session rejection.
- `pnpm quality:gate` runs the recovery contract, i18n, secret scan, and E2E.
