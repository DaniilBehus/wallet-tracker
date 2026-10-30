**English** · [Slovenčina](../../locales/sk/qa/docs/analysis-schedule-editing.md)

# Schedule editing — local UI contract

[← Back to README](../../README.md#qa-evidence) · [Core requirements](../../spec/core-requirements.md#req-core-21) · [Next: local test report →](test-report-schedule-editing.md)

This is the F09 implementation contract, recorded before UI changes on
2026-10-17. The historical BUG-021 report cites an older §6.4 requirement;
that is the recorded observation, not a newly recovered quote. The current
architecture describes creation, while the current API already supports
`PATCH /api/schedules/{id}`. The UI must expose that existing capability
without changing the backend or frozen architecture document.

| UI field | Stored/PATCH field | Rule |
|---|---|---|
| Name | `name` | Prefill exact stored text; nonempty, at most 60 characters. |
| Amount | `amount_cents` | Show exact decimal euros, submit integer cents in supported range. |
| Category | `category_id` | Owned ID or `null` for uncategorised/deleted category; server checks ownership. |
| Day | `day_of_month` | Integer 1–31, including documented last-day clamping. |
| Start date | `starts_on` | Exact stored ISO date, server remains date authority. |
| Loan choice/count | `total_count` | `null` subscription or integer 1–1200 loan; server rejects count below already paid, equality closes and raising a closed loan reopens it. |

The dialog opens from an owned Schedules row, prefilled from that row's full
API object. Save sends **one PATCH to that row ID**, never a POST. No `id`,
`user_id`, `paid_count` or `active` is sent. Success replaces the visible row
from a fresh list read, without rewriting historical expenses or paid count.
An existing pending Pay still uses its own frozen preconditions; an edit does
not silently retry or replace that payment identity.

Cancel/Escape/backdrop **before Save** close the editor without PATCH; the
opener regains focus when still present. Navigation or session end closes the
editor and suppresses its late callback, but cannot undo a PATCH already sent.
Native modal focus stays inside
on Tab/Shift+Tab, and all fields and actions remain reachable at 320×568.
Obvious invalid input is rejected before PATCH with an in-dialog message.
Server 404/409 or validation errors keep the editor and entered values, show
the refusal, and never claim a save. A transport error may have committed;
the UI must say the result is uncertain, not that nothing changed. Every
async completion is bound to the opening account/session/screen/dialog.

Acceptance needs a pre-repair missing-Edit witness, then post-repair browser
checks of persisted IDs/fields and request method/count. Include subscription
and loan conversions, paid-count conflict/equality/reopen, missing/foreign
ownership via the real API, rejection without false success, cancellation,
keyboard and late-callback behavior. Browser controls are supplemental to the
unchanged 280-case catalogue; contract tests and static checks have separate
evidence boundaries. [Runtime report](test-report-schedule-editing.md).
