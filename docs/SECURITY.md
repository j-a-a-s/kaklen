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

The committed `.env.example` contains only development defaults.

## API Hardening

The NestJS API enables Helmet by default. CORS is limited to the local Angular development origin in the foundation setup.

Locale preferences are allow-listed to `es`, `en`, and `pt-BR` on the API. The frontend must translate user-facing errors from stable `code` values instead of relying on backend message text.

## Password Recovery

- Recovery tokens use 48 random bytes and are persisted only as SHA-256 hashes.
- Each token expires, is single-use, and a new request revokes earlier valid links.
- The request response does not confirm whether an account exists or is active.
- IP and user-agent values are stored only as HMAC values for audit support; passwords, tokens, and full email addresses are not logged.
- A successful reset updates Argon2id, consumes the token, revokes refresh tokens, and increments `User.authVersion` in one transaction.
- Registration creates no session. Login, refresh, JWT guards, and password recovery require `emailVerifiedAt` in addition to `User.status = ACTIVE`.
- Email verification tokens are random, stored only as SHA-256 hashes, expire, are single-use, and are rotated on resend. SMTP failure revokes the undelivered token while preserving the pending account.
- `JwtAuthGuard` compares the JWT session version with the current user version.
- Limits by IP, normalized email, and token reduce spam and automated attempts.

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
