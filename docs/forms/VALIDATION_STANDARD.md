# Validation Standard

## Source Of Truth

Frontend controls use `VALIDATION_LIMITS` from `@kaklen/shared`, matching DTO and Prisma constraints. Shared validators live in `apps/web/src/app/shared/forms/form-validators.ts`; feedback components live in `form-feedback.components.ts`. A feature may add a domain rule, but must not duplicate email, phone, decimal, whitespace, date-order, or at-least-one validation.

## Shared Components

- `kaklen-required`: visible asterisk plus screen-reader text.
- `kaklen-optional`: visually separate optional label.
- `kaklen-field-error`: precise error, icon, and `role="alert"`.
- `kaklen-form-error-summary`: count and names of invalid fields after submit.

Controls connect helper and error text with `aria-describedby`, set `aria-required` where appropriate, and expose `aria-invalid` through the shared field styles. A failed submit marks controls touched, focuses the first invalid input, and prevents navigation to another wizard step.

## Rules

| Data | Rule | Normalization |
| --- | --- | --- |
| Email | Realistic structure and shared maximum length | Trim and lowercase |
| Phone | Optional `+`, digits with visual separators, 7-15 digits; Chile accepts 9 or 11 digits | Preserve leading `+`, store digits only |
| Text | Trim, reject whitespace-only values, enforce shared max length | Trim |
| Decimal | Finite decimal, explicit min/max and database precision | Decimal point for transport |
| RUT | Modulus-11 validation; required for Chilean companies | Canonical formatted RUT |
| Dates | Parseable values and ordered start/end or issue/valid-until | ISO date or timestamp |

Email errors say that a valid address is required and include `nombre@empresa.cl`. Phone errors include `+56 9 1234 5678`. Numeric errors state the allowed range and precision.

## Submission

Normalize immediately before creating the DTO. Do not use visual currency separators in API payloads. Every async form has a busy guard so repeated clicks cannot create duplicate operations. API validation remains authoritative and frontend errors are translated from typed backend error codes.
