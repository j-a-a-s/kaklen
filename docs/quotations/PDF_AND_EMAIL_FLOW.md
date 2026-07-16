# PDF And Email Flow

## Authenticated PDF Download

The browser never navigates directly to the PDF endpoint and never puts a token in a URL. `QuotationsService.downloadPdf` uses authenticated `HttpClient`, requests the full response as a `blob`, validates `application/pdf`, and derives a safe filename from `Content-Disposition`. The component creates a temporary object URL, triggers download, and always revokes the URL.

The API endpoint validates JWT, permission, organization membership, and tenant ownership. It generates a real PDF whose first bytes are `%PDF`, responds with `Content-Type: application/pdf`, and sends a quoted, sanitized filename. Errors retain their non-200 status and JSON error contract.

## Quotation Email

The email dialog preloads the client address but allows edits. Recipient, subject, and message are validated before submission. A busy guard prevents duplicate sends.

The API sequence is:

1. load the tenant-scoped quotation and validate its state;
2. generate the current localized PDF;
3. render the `es`, `en`, or `pt-BR` HTML and text template with escaped input;
4. send through `MailService`/Nodemailer with the PDF attachment;
5. only after SMTP succeeds, update `DRAFT` to `SENT` when applicable;
6. write status history and audit records without storing message content or credentials.

If SMTP fails, no quotation state, history, or audit success record is committed. Development delivery uses Mailpit at `http://localhost:8025` with non-production credentials.

## Verification

Unit and integration tests assert PDF magic bytes, filename, tenant isolation, attachment metadata, localized templates, audit creation, state changes after success, and no writes after SMTP failure. E2E must verify the downloaded file and Mailpit message instead of simulating success.
