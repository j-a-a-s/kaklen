# Interaction Patterns

## Buttons

Kaklen uses one semantic hierarchy across every module:

| Variant | Purpose | Examples |
| --- | --- | --- |
| Primary | Main operation on the current screen | Save, create, start |
| Success | Positive business transition | Approve, confirm, complete |
| Danger | Destructive or terminal operation | Reject, cancel, archive |
| Secondary | Supporting operation | Download PDF, duplicate, new version |
| Ghost | Navigation with low visual weight | Back |

Buttons use `kaklen-icon` plus a visible label whenever space permits. Compact icon-only buttons require an `aria-label` and `title`. Labels never use `word-break: break-all`; narrow layouts use a documented icon-only presentation or ellipsis.

All asynchronous commands expose a busy label or disabled state and guard against a second invocation in the component method. Focus is always visible.

## Action Menu

`ActionMenuComponent` is the only action dropdown. Consumers project buttons through `kaklenMenuItem` and provide `contextKey` when the menu belongs to an organization.

The menu:

- opens from its trigger or with `ArrowDown` and `ArrowUp`;
- supports `ArrowDown`, `ArrowUp`, `Home`, `End`, `Enter`, `Escape`, and `Tab`;
- closes after selection, outside pointer interaction, route navigation, or context changes;
- returns focus after selection or `Escape`;
- keeps the panel inside the viewport and opens above the trigger when required;
- unsubscribes from router and projected-content listeners on destruction.

Do not implement dropdown behavior with native `details`, per-screen document listeners, or duplicated positioning code.

## Dialogs And Tooltips

Destructive actions use `ConfirmationDialogComponent`, describe the consequence, trap focus, close on `Escape`, and restore focus. Browser `confirm()` is not used.

Tooltips are required when a visible label is truncated or an action is icon-only. The accessible name must contain the complete command independently of the tooltip.

## Responsive Actions

Desktop headers keep the main action visible and place lower-priority commands in the action menu. Tablet and mobile keep at most two visible commands. Action rows wrap or stack without horizontal overflow; sticky quotation summaries must not cover form controls.

## Icons

Use the shared Lucide-backed icon component. Standard mappings include `arrow-left` for back, `check` for approve, `x-circle` for reject/cancel, `download` for PDF, `copy` for versions, `ellipsis` for menus, `play` for start, `flag` for complete, `calendar` for events, `plus` for creation, `search`, `mail`, `phone`, `message-circle`, `pencil`, and `archive`.
