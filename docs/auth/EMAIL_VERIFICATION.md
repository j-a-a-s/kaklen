# Email Verification

## Account lifecycle

1. `POST /api/auth/register` creates an `ACTIVE` user with `emailVerifiedAt = null`.
2. The API creates a cryptographically random 48-byte URL-safe token and stores only its SHA-256 hash.
3. `MailService` sends the localized confirmation message through the configured SMTP server.
4. Registration returns a message only. It never creates an access token, refresh token, cookie, or authenticated session.
5. `POST /api/auth/verify-email` consumes the single-use token in a transaction, sets `emailVerifiedAt`, revokes other pending confirmation tokens, and writes an audit event.
6. The user signs in manually. Login returns `403 EMAIL_NOT_VERIFIED` until verification succeeds.

`User.status` and email verification are independent. `ACTIVE` means the account is operationally allowed, while `emailVerifiedAt` proves ownership of the address. `INACTIVE`, `SUSPENDED`, and `ARCHIVED` accounts cannot verify, resend, sign in, or recover a password.

## Delivery failure policy

If SMTP delivery fails, the account remains pending so it can be recovered through resend. The new token is revoked, no success audit is written, and no session is created. The public registration response stays safe, while `[mail:failed]` and the failed audit event preserve operational truth. This avoids losing a valid registration because of a temporary provider outage without leaving an undisclosed usable token.

## Endpoints

- `POST /api/auth/register`: create a pending account and request delivery.
- `POST /api/auth/verify-email`: consume a confirmation token.
- `POST /api/auth/resend-verification-email`: return a generic response and enqueue the same job type for every allowed request; a worker sends only for an eligible pending account.
- `POST /api/auth/login`: issue a session only for an active, verified account.

Resend uses shared Redis limits by IP and normalized email. The response is identical for missing, verified, suspended, and pending accounts. The worker revokes every previous unused token before creating a replacement and retries delivery at most three times with exponential backoff.

## Configuration

```bash
APP_PUBLIC_URL=http://localhost:4200
EMAIL_VERIFICATION_EXPIRES_MINUTES=1440
MAIL_FROM="Kaklen <no-reply@kaklen.local>"
MAIL_HOST=localhost
MAIL_PORT=1025
MAIL_SECURE=false
```

The API builds the link from `APP_PUBLIC_URL` and the persisted user locale. It accepts only the configured origin and the exact localized `/:locale/verify-email` path; the browser cannot supply an arbitrary redirect URL.

## Local verification

Run `pnpm dev:full:i18n`, open a localized registration page, and inspect Mailpit at `http://localhost:8025`. A successful delivery writes `[mail:sent]` with `mailType=email_verification`, a recipient fingerprint, locale, provider `messageId`, delivery counts, and timestamp. Logs never include the full email, raw token, full URL, password, message body, or SMTP credentials.

The migration backfills `emailVerifiedAt` for existing users before enforcing the new login rule. New registrations remain pending. Demo seeds always create explicitly verified users.

Unit tests cover token states, hashing, SMTP failure, rate limits, audit, and no-session behavior. Integration tests exercise the HTTP contract. Playwright reads the real Mailpit message, verifies rotation and single use, confirms the account, and signs in manually.
