# Security

## Supported Baseline

Kaklen currently supports the foundation branch and its direct successors. Security fixes should be applied to the active development branch first.

## Secrets

Secrets must not be committed. Use local `.env` files for development and repository or deployment secrets for CI/CD.

Ignored local files include:

- `.env`
- `.env.local`
- `*.log`
- build outputs

The committed `.env.example` contains only development defaults. Production startup fails before Nest is created unless cryptographic secrets are independent hexadecimal values of at least 64 characters. Generate each value with `openssl rand -hex 32`.

## API Hardening

The NestJS API explicitly denies framing, enables MIME sniffing protection, uses a `no-referrer` policy, and enables one-year HSTS with subdomains only in production. Credentialed CORS uses an explicit origin, method, request-header, response-header, and preflight-cache contract. Swagger is always disabled in production.

Production origins must use HTTPS and cannot contain localhost, loopback addresses, wildcards, `null`, credentials, paths, queries, or fragments. `COOKIE_SECURE=true`, `DATABASE_SSL=true`, and `REDIS_URL` are mandatory. The production `DATABASE_URL` must also include `sslmode=require` so Prisma cannot fall back to an unencrypted PostgreSQL connection. Production Redis must use `rediss://` and a managed, non-loopback endpoint; local `redis://` remains valid only outside production.

Locale preferences are allow-listed to `es`, `en`, and `pt-BR` on the API. The frontend must translate user-facing errors from stable `code` values instead of relying on backend message text.

## Password Recovery

- Recovery tokens use 48 random bytes and are persisted only as SHA-256 hashes.
- Each token expires, is single-use, and a new request revokes earlier valid links.
- The request response does not confirm whether an account exists or is active.
- IP and user-agent values are stored only as HMAC values for audit support; passwords, tokens, URLs, and full email addresses are not logged.
- A successful reset updates Argon2id, consumes the token, revokes refresh tokens, and increments `User.authVersion` in one transaction.
- Registration creates no session. Login, refresh, JWT guards, and password recovery require `emailVerifiedAt` in addition to `User.status = ACTIVE`.
- Email verification tokens are random, stored only as SHA-256 hashes, expire, are single-use, and are rotated on resend. SMTP failure revokes the undelivered token while preserving the pending account.
- `JwtAuthGuard` compares the JWT session version with the current user version.
- A global 100-request-per-minute policy protects API routes by route and IP through atomic Redis counters. Authentication routes with dedicated distributed policies remain excluded from the global counter, refresh/logout use 20 requests per minute, and health endpoints remain unthrottled.
- Limits by IP, normalized email, and token use atomic Redis counters. Keys contain HMAC-SHA256 identifiers, fixed-window TTLs are not extended per request, and backend failure returns a stable 503 without an in-memory fallback.
- Password reset and verification resend requests enqueue durable BullMQ jobs. Workers perform account lookup, token rotation, SMTP delivery, auditing, and at most three exponential-backoff attempts.
- Login validates persisted Argon2id PHC data before verification. Missing accounts and malformed hashes verify only a precomputed dummy hash and return the same generic 401; operational Argon2 failures propagate as sanitized 500 responses.
- Redis and BullMQ lifecycle events use structured, deduplicated operational logs containing only event, component, safe error name/code, state, and timestamp.

See [Email Verification](auth/EMAIL_VERIFICATION.md) and [Password Recovery](auth/PASSWORD_RECOVERY.md) for the complete flows and environment configuration.

## Dependency Updates

Dependabot covers pnpm workspace dependencies, GitHub Actions, and Docker
images. Cadence, grouping, major-version handling, and review controls live in
[Dependency Updates](governance/DEPENDENCY_UPDATES.md).

## Reporting

For now, report security issues privately to the repository owner. Do not open public issues with exploit details.
