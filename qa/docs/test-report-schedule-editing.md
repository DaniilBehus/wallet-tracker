**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-schedule-editing.md)

# F09 schedule-edit UI — local verification

[← Back to README](../../README.md#qa-evidence) · [Edit contract](analysis-schedule-editing.md) · [Next: test setup →](../../docs/testing.md)

Date: 2026-10-17. This report documents an uncommitted local repair. Its later
scoped independent agent review is recorded below; it is not a remote CI run,
release or owner UAT.

## Before/after evidence

The one planned pre-repair managed browser witness failed: an existing owned
schedule had no `schedule-edit-{id}` control. Adding the button alone made that
small witness pass 2/2, but **did not prove the form worked**. The first broader
12-test run then had 10 identical timeouts after the click. Its retained trace
showed `TypeError: Cannot set properties of null (setting 'value')` at
`openScheduleEditor`: new HTML inputs had `data-testid` but lacked the `id`
used by the app selectors. Work stopped after the repeated failure; all new
editor IDs were aligned in the subsequent bounded repair. A full opening,
prefill, PATCH, persisted-ID/no-POST happy path then passed 1/1 before the
other controls resumed. The earlier red runs remain red historical evidence.

## Current local results

| Check | Result and limit |
|---|---|
| Schedule-edit supplemental browser controls | 18/18 across phone and desktop: prefill/same-ID PATCH/no extra schedule; Cancel/Escape/focus; 320×568 scroll/Tab containment; validation and server 404/409; paid-count conflict/equality/reopen/subscription conversion; committed lost reply; stale navigation and newly signed-in account. The foreign ownership 404 is also checked against the real disposable API; the UI 404 is a clearly marked test-only response seam. |
| Main managed browser suite | 236/236 with four workers on a disposable local server/database. This includes the nine new scenarios in two viewports; the catalogue remains 280 cases, not 298. |
| AI browser | 50/50 with local fake provider; no live model call. |
| Contract | 18/18 including existing schedule PATCH/pay/ownership controls and keyed Pay; backend was not edited. |
| Pure/static | 105/105 source/gate controls, 13/13 CI-plan controls; current source inventory 280 main IDs, OpenAPI 21 operations/308 local refs, F13 280 IDs/78 rule definitions, `scripts/check.js` 8/8. These are structural checks, not 280 behavior passes. |

The UI sends only changed editable fields, never server-owned IDs, paid count
or active flag. A successful response is followed by a fresh schedules read.
A server refusal leaves entered values visible and restores the button label;
a lost response after a real commit says the outcome is unknown. The modal
closes on navigation/session end and a late response cannot mutate another
screen/account. It does not provide optimistic concurrency for two simultaneous
editors; the server remains authority for ownership and paid-count conflicts.

BUG-021 remains **High/IN PROGRESS** after local acceptance; combined-tree
verification, exact-SHA remote CI, publication and owner UAT remain. No
historical BUG observation is rewritten as if it had not happened.

## Scoped independent local review — 2026-10-17

Independent agent review accepted F09 locally. The accepted finding count is
now **24/25 (96% by finding count)**, not a measure of test coverage, effort,
time or release readiness. The initial red witness and first implementation
failure above remain part of the evidence. The review established no further
known schedule-edit defect; it did not run exact-SHA remote CI, publish the
change, perform owner UAT or approve release.
