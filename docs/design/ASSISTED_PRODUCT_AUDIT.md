# Assisted product audit

## Problem

The MVP exposed complete administrative modules, but a new user still had to infer the correct operating sequence. Navigation, dashboards, forms, search, and empty states described records more often than they suggested the next useful action.

## Decision

Kaklen now derives activation and operational recommendations from existing tenant data. No duplicate onboarding state was added to Prisma. A single organization-scoped assistant API aggregates activation, dashboard signals, global search, recent activity, and client timeline data while preserving existing RBAC.

## Implementation evidence

| Surface | Principle | Evidence | Automated proof |
| --- | --- | --- | --- |
| Activation and onboarding | Progressive disclosure with real progress | `assisted-onboarding.png`, `mobile-assisted-onboarding.png` | `user-activation.service.spec.ts`, `assisted-product.spec.mjs` |
| Assisted dashboard | Answer what needs attention and what comes next | `assisted-dashboard-data.png`, `assisted-dashboard-new.png` | `assistant.service.spec.ts`, dashboard E2E |
| Command Palette | One keyboard-first entry point for navigation, action, and search | `assisted-command-palette.png`, `assisted-global-search.png` | static keyboard test, Playwright focus test |
| Client wizard | Ask only for information relevant to the current step | `assisted-client-wizard.png` | guided workflow E2E and RUT unit tests |
| Quotation wizard | Keep client, items, conditions, and review understandable | `assisted-quotation-wizard.png`, `mobile-assisted-quotation-wizard.png` | guided workflow E2E and cent-based preview checks |
| Event wizard | Support approved-quotation and manual paths without blocking drafts | `assisted-event-wizard.png`, `mobile-assisted-event.png` | guided workflow E2E and optional-operation test control |
| Client timeline | Put commercial and operational context in chronological order | `assisted-client-timeline.png` | assistant timeline unit and integration tests |
| Organization activity | Make team work visible without duplicating AuditLog | `assisted-recent-activity.png` | batched activity unit test |
| Empty states | Explain benefit and offer a direct action | `assisted-empty-state.png` | assisted product static checks and responsive E2E |

## Security and performance

- Every assistant route requires an authenticated organization membership.
- Search SQL includes `organizationId`, uses parameterized Prisma SQL, limits each category, and respects read permissions.
- Search is accent-insensitive through PostgreSQL `unaccent`; the migration documents the tenant-leading indexes used by the query paths.
- Dashboard metrics are aggregated in one request and activity resources are loaded in batches to avoid N+1 queries.
- The Command Palette waits for two characters and debounces requests by 250 ms.
- Product analytics accepts only typed event, flow, step, and source fields; it cannot receive email, RUT, names, or form content.

## Accessibility

The assisted surfaces provide visible focus, semantic progress, accessible form labels, modal focus containment, Escape handling, focus return, live search status, and responsive layouts for 390 x 844, 820 x 1180, 1366 x 768, and 1440 x 900. `pnpm accessibility:test` verifies authenticated dashboard, palette, wizards, timeline, and mobile navigation in addition to all localized login screens.

## Reproduction

1. Run `pnpm db:clear:demo && pnpm db:seed:demo && pnpm db:verify:demo`.
2. Start the full environment with `pnpm dev:full:i18n`.
3. Run `pnpm screenshots:assisted` to regenerate the evidence.
4. Run `pnpm quality:gate` for the complete release control set.
