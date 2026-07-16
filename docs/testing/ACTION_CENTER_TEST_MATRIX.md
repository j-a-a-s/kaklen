# Action Center Test Matrix

## Static Actions

| Action | Permission | Expected route |
| --- | --- | --- |
| New client | `clients.create` | `/organizations/:id/clients/new` |
| Add product or service | `catalog.create` | `/organizations/:id/catalog/new` |
| New quotation | `quotations.create` | `/organizations/:id/quotations/new` |
| New event | `events.create` | `/organizations/:id/events/new` |
| Invite member | `organization.members.invite` | `/organizations/:id/members` |
| Change organization | Authenticated user | `/organizations` |

Navigation entries cover home, clients, catalog, quotations, events, members, and settings with their matching read or update permission.

## Search Groups

Local actions filter from the first character with accent-insensitive comparison. At two characters the debounced request searches clients, catalog, quotations, and events in parallel on the backend. Tests verify title, code, SKU, client, aliases, loading, empty state, recoverable error, stale-response rejection, and tenant-scoped routes.

## Interaction Matrix

| Behavior | Unit | Integration/E2E |
| --- | --- | --- |
| Every action navigates and closes | `command-palette.component.spec.ts` | assisted product journey |
| RBAC hides unavailable commands | component spec | tenant permissions |
| Arrow/Home/End and Enter | component spec | keyboard journey |
| Escape and outside click | component spec | accessibility journey |
| Focus trap and focus return | component spec | accessibility journey |
| Body scroll blocked while open | component spec | responsive accessibility |
| Client/catalog/quotation/event results | component spec | API search contract |
| Route and organization changes close palette | component spec | navigation journey |
| Analytics excludes PII | static contract | event inspection |

No test uses fixed sleeps. Playwright waits on accessible UI state, URL changes, API responses, or polling assertions.
