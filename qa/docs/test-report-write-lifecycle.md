**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-write-lifecycle.md)

# F06/F10 local write-recovery and request-lifecycle report

[← Back to README](../../README.md#qa-evidence) · [Recovery contract](analysis-write-recovery.md) · [Next: test setup →](../../docs/testing.md)

Date: 2026-10-17. This describes an **uncommitted local checkout**, not a
remote CI result, release, owner UAT, or proof of every network failure.

## Observed problem and repair

Three controlled browser witnesses failed before the repair: ordinary Save and
Pay each committed to a disposable server but lost the response and offered no
same-identity recovery; an older Month response replaced a newer total. The
tests use a real local commit followed by a withheld browser reply, not a fake
successful result. After repair, Save and keyed Pay persist a frozen,
account-scoped operation in browser storage before dispatch. An uncertain
result stays visible; only an explicit Check/retry uses the identical key and
body. A new deliberate action uses a different key. The server's opted-in Pay
branch atomically records/replays the key, including the final loan payment;
unkeyed Pay remains compatible. An unreadable recovery record blocks new
financial writes rather than silently dropping the evidence.

The browser also guards current session and screen generations after response
body parsing and on rejected requests, constrains a request's headers **and
body** to a ten-second deadline, and lets only the current busy owner release
its controls. The auth-to-app session handover originally left `busy` set;
that local repair was confirmed by its targeted regression. Screen navigation
does not automatically resend a financial write.

An earlier **210-test** managed core run after the initial repair passed
204/210. It exposed Pay-refusal wording and app-start navigation regressions,
which were repaired and passed focused reruns. Its separate short-lived toast
failure had no established cause; it is not retroactively called flaky or
resolved by assertion. Later test additions raised the discovered total to
218, so the runs below are not the same test inventory.

## Local results

| Check | Result and boundary |
|---|---|
| Controlled pre-repair witnesses | 3 expected red: lost-reply Save, lost-reply Pay, stale Month total. |
| New `support_control:` browser scenarios | 26/26 across phone and desktop after final callback-barrier adjustment: committed Save/Pay replay, distinct next action, final-loan closure, reload/account separation, storage and invalid-body failures, finite body deadline, stale 401/network error/read/screen/busy callbacks. Supplemental controls, **not** new catalogue IDs. |
| Main managed browser suite | Earlier 210-test run: 204/210, with the distinctions above. Later 218-test run: 217/218; one desktop fixture failed at `page.goto('/')` with `net::ERR_ABORTED` before its category-state scenario. That exact scenario then passed 2/2 separately. After the test-only callback-barrier adjustment, a separate complete managed run with four local workers passed **218/218**. |
| AI browser and synthetic import | 50/50 local fake-provider browser scenarios; 11/11 offline synthetic-import controls. No live provider call. |
| Contract and static controls | 18/18 contract tests (including keyed Pay/legacy behavior); 62/62 inventory/traceability/validator controls; 13/13 CI-plan controls; current source inventory 280 main cases; static traceability 280 IDs/78 definitions; OpenAPI 21/21 operations and 308 local refs; `scripts/check.js` 8/8. These static checks do not execute 280 catalogue cases. |

The 217/218 run's setup failure is not attributed to the product or declared
flaky without evidence; the later complete green run is separate evidence,
not a retroactive pass for that run or the earlier 204/210 run. No remote CI run or exact-SHA
publication is claimed. Local browser storage is not an atomic cross-tab lock;
a manually abandoned uncertain operation may already have committed, so the
warning is intentional. Owner review, full combined verification and release
decision remain separate.

## Scoped independent local review — 2026-10-17

An independent agent reviewed the frozen F06/F10 source and local evidence and
accepted **both findings locally**. The locally accepted count is now **23/25
(92% by finding count, not coverage, effort, time or release readiness)**.
This review does not convert static inventory into behavioral execution,
establish remote CI for the uncommitted tree, clear owner UAT, or authorize
publication. Combined-tree verification and release disposition remain open.
