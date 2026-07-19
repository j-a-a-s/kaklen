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

Production origins must use HTTPS and cannot contain localhost, loopback addresses, wildcards, `null`, credentials, paths, queries, or fragments. `COOKIE_SECURE=true`, `DATABASE_SSL=true`, and `REDIS_URL` are mandatory.

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
- Limits by IP, normalized email, and token use atomic Redis counters. Keys contain HMAC-SHA256 identifiers, fixed-window TTLs are not extended per request, and backend failure returns a stable 503 without an in-memory fallback.
- Password reset and verification resend requests enqueue durable BullMQ jobs. Workers perform account lookup, token rotation, SMTP delivery, auditing, and at most three exponential-backoff attempts.
- Login always performs one Argon2id verification. Missing accounts use a precomputed dummy hash, so account lookup does not create an obvious password-hash timing branch.

See [Email Verification](auth/EMAIL_VERIFICATION.md) and [Password Recovery](auth/PASSWORD_RECOVERY.md) for the complete flows and environment configuration.

## Dependency Updates

Dependabot is configured for:

- npm workspace dependencies.
- GitHub Actions.
- Docker images.

Review dependency updates with the normal validation flow:

```bash
pnpm install
pnpm prisma:generate
pnpm lint
pnpm test
pnpm build
```

## Reporting

For now, report security issues privately to the repository owner. Do not open public issues with exploit details.
