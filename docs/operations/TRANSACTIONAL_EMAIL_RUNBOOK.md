# Transactional Email Runbook

## Purpose

This runbook defines every step required to enable real transactional email delivery for Kaklen in production. It covers provider selection, DNS authentication, credential management, TLS, deliverability controls, testing, rotation, and the evidence gate that must pass before the `REAL_TRANSACTIONAL_EMAIL_VALIDATED` criterion can be set to `true`.

No provider is selected and no credentials are introduced by this document.

## Prerequisites

- Local email testing works via Mailpit (see [LOCAL_EMAIL_TESTING.md](../notifications/LOCAL_EMAIL_TESTING.md)).
- The API email module (`@kaklen/api` mail service) supports the standard SMTP transport configuration via environment variables.

## 1. Provider Selection

> **OWNER_DECISION:** Select one transactional email provider. Evaluate based on:

| Criterion | Notes |
| --- | --- |
| Deliverability reputation | Shared IP vs. dedicated IP |
| Geographic compliance | Data residency requirements for Chile / LATAM |
| API and SMTP support | The Kaklen API uses SMTP transport; verify provider supports authenticated SMTP |
| Bounce and complaint webhooks | Required for deliverability monitoring |
| Pricing model | Per-email vs. monthly volume |
| SLA and uptime guarantees | Required for production |

Candidates to evaluate (not a recommendation): Amazon SES, Resend, Postmark, SendGrid, Mailgun.

**Do not proceed until a provider is selected and an account is created.**

## 2. Sender Domain Configuration

### 2.1 Choose the sender domain

- Production sender: `no-reply@<domain>` (e.g., `no-reply@kaklen.cl`).
- The domain must be owned and controlled by the organization.

### 2.2 DNS Records

Configure the following DNS records for the chosen domain:

#### SPF

```
TXT  <domain>  "v=spf1 include:<provider-spf-include> -all"
```

- Use `-all` (hard fail) to reject unauthorized senders.
- Verify with: `dig TXT <domain>` or an online SPF checker.

#### DKIM

- Generate a DKIM key pair through the provider's dashboard.
- Add the CNAME or TXT record as specified by the provider.
- Verify with: `dig CNAME <selector>._domainkey.<domain>` or the provider's verification tool.

#### DMARC

```
TXT  _dmarc.<domain>  "v=DMARC1; p=reject; rua=mailto:dmarc-reports@<domain>; pct=100"
```

- Start with `p=none` during initial testing, then move to `p=quarantine`, then `p=reject`.
- Verify with: `dig TXT _dmarc.<domain>`.

### 2.3 Verification Checklist

- [ ] SPF record published and verified.
- [ ] DKIM record published and verified.
- [ ] DMARC record published with at least `p=none`.
- [ ] Provider dashboard shows domain as "verified" or "authenticated".
- [ ] Test email passes SPF, DKIM, and DMARC alignment (check raw headers).

## 3. Credential Management

### 3.1 Secrets Manager

Store SMTP credentials in AWS Secrets Manager under a well-defined path:

```
kaklen/<environment>/mail/smtp
```

JSON structure:

```json
{
  "host": "<provider-smtp-host>",
  "port": 587,
  "secure": false,
  "user": "<smtp-username>",
  "password": "<smtp-password>"
}
```

- `secure: false` with port 587 uses STARTTLS (upgraded to TLS after connection).
- `secure: true` with port 465 uses implicit TLS.

### 3.2 Environment Variables

The ECS task definition must inject these from Secrets Manager:

| Variable | Source |
| --- | --- |
| `MAIL_HOST` | Secret `host` |
| `MAIL_PORT` | Secret `port` |
| `MAIL_SECURE` | Secret `secure` |
| `MAIL_USER` | Secret `user` |
| `MAIL_PASSWORD` | Secret `password` |
| `MAIL_FROM` | Parameter Store: `Kaklen <no-reply@<domain>>` |

### 3.3 Access Control

- Only the ECS task role may read the secret.
- CI/CD pipeline must not log or expose mail credentials.
- No credentials in source code, `.env` files committed to git, or Terraform state outputs.

## 4. TLS Requirements

- SMTP connection must use TLS (STARTTLS on port 587 or implicit TLS on port 465).
- Reject connections that fail TLS negotiation (`MAIL_SECURE=false` with STARTTLS is acceptable; plaintext on port 25 is not).
- The provider's SMTP endpoint must present a valid certificate.

## 5. Bounce and Complaint Handling

### 5.1 Webhook Configuration

Configure the provider's bounce and complaint webhooks to an API endpoint or SNS topic:

| Event | Action |
| --- | --- |
| Hard bounce | Mark the email address as undeliverable; do not retry |
| Soft bounce | Retry up to 3 times with exponential backoff; then treat as hard bounce |
| Complaint (spam report) | Immediately suppress the address; log for review |
| Unsubscribe | Suppress the address for the relevant notification type |

### 5.2 Suppression List

- Maintain a suppression list of addresses that have hard-bounced or filed complaints.
- Check the suppression list before every send.
- Provide a manual override process for addresses incorrectly suppressed (dual control).

## 6. Rate Limits

| Limit | Value | Notes |
| --- | --- | --- |
| Per-second send rate | Provider-defined | Respect provider limits; implement client-side throttling if needed |
| Daily send volume | Provider-defined | Monitor and alert at 80% of quota |
| Per-recipient hourly limit | 5 (suggested) | Prevent accidental spam to a single address |

## 7. Email Types and Templates

The following transactional emails must be verified:

| Email type | Trigger | Template | Priority |
| --- | --- | --- | --- |
| Email verification | User registration | Verification link with expiry | P0 |
| Password reset | User-initiated reset | Reset link with expiry | P0 |
| Organization invitation | Admin invites member | Invitation link | P1 |
| Quotation shared (future) | Quotation published | Portal link | P2 |

Each template must:

- Include the `MAIL_FROM` sender.
- Contain an unsubscribe mechanism where legally required.
- Render correctly in major email clients (Gmail, Outlook, Apple Mail).
- Not include secrets, passwords, or full tokens in the email body.

## 8. E2E Testing with Controlled Addresses

### 8.1 Pre-Production Testing

1. Create a set of controlled test email addresses (e.g., `test+verification@<domain>`, `test+reset@<domain>`).
2. Trigger each email type through the application.
3. Verify receipt, SPF/DKIM/DMARC pass, link validity, and template rendering.
4. Verify that emails to suppressed addresses are not sent.
5. Verify that rate limiting rejects excess sends gracefully.

### 8.2 Evidence Collection

For each email type, capture:

- Raw email headers (SPF, DKIM, DMARC results).
- Screenshot or text of rendered email.
- Timestamp of send and receipt.
- Delivery status from provider dashboard.

## 9. Credential Rotation and Revocation

### 9.1 Rotation Schedule

> **OWNER_DECISION:** Define rotation frequency. Recommended: every 90 days.

### 9.2 Rotation Procedure

1. Generate new SMTP credentials in the provider dashboard.
2. Update the secret in AWS Secrets Manager.
3. Trigger an ECS task restart to pick up the new credentials.
4. Verify email delivery with a test send.
5. Revoke the old credentials in the provider dashboard.
6. Record the rotation in the operations log.

### 9.3 Emergency Revocation

If credentials are suspected compromised:

1. Immediately revoke the credentials in the provider dashboard.
2. Generate new credentials and update Secrets Manager.
3. Restart ECS tasks.
4. Review send logs for unauthorized emails.
5. File an incident report per [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md).

## 10. Evidence Gate: REAL_TRANSACTIONAL_EMAIL_VALIDATED

The `REAL_TRANSACTIONAL_EMAIL_VALIDATED` criterion in the production evidence contract requires:

| Check | Evidence |
| --- | --- |
| Provider account active | Screenshot or API response showing active status |
| Domain verified with SPF, DKIM, DMARC | DNS query results and provider verification status |
| Credentials stored in Secrets Manager | AWS CLI output showing secret exists (value redacted) |
| TLS enforced | Raw SMTP headers showing TLS negotiation |
| All email types delivered to controlled addresses | Delivery receipts and rendered screenshots |
| Bounce webhook configured and tested | Webhook delivery log |
| Suppression list operational | Test showing suppressed address is skipped |
| Rotation procedure documented and tested | Operations log entry for at least one rotation |

All checks must be validated against the same commit SHA as the release. Set `validated: true` and `validatedAt` only after all checks pass.
