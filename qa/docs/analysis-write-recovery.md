**English** · [Slovenčina](../../locales/sk/qa/docs/analysis-write-recovery.md)

# Financial write recovery and request lifecycle

[← Back to README](../../README.md#qa-evidence) · [Next: local verification](test-report-write-lifecycle.md)

## Scope and evidence boundary

**Pre-implementation baseline, recorded 2026-10-17:** ordinary Add expense
and schedule Pay had no browser recovery identity when the server committed
but the reply was lost. At that point this document defined the opt-in
recovery contract; it did not claim a lost-reply browser reproduction, and
core read races were source risks pending controlled tests. Those sentences
describe the earlier state, **not** the current local implementation. The
[subsequent local report](test-report-write-lifecycle.md) records the actual
before/after browser evidence, repair and bounded independent review. The
existing AI and synthetic-import contracts remain separate.

## One deliberate financial action

Create a UUID and freeze an account-scoped record before dispatch. Save freezes amount, category, note and explicit local `spent_on`; Pay freezes schedule ID, displayed name/amount/category/paid and total counts, and explicit date. Keep a separate local-storage key for each operation UUID under the JWT `sub` account namespace, not a single overwritable account slot. A record contains no token. Reject dispatch if its durable write fails; malformed persisted records are quarantined and block another financial action rather than being silently discarded. All unresolved records for the active account are shown; no other account may see or send them. More than one tab can still race: local storage is not an atomic cross-tab lock, and this design does not promise exactly-once *intent*.

States: `prepared → sending → confirmed | refused | uncertain`. A valid successful response matching the operation's shape and identity confirms it and removes only its own storage key. A known pre-commit 4xx is refused with a specific explanation, while conflict/tombstone responses remain visible until the person acknowledges them; no fresh key is manufactured to get around a conflict. Network error, abort, 10-second deadline, 5xx, invalid/non-JSON/incomplete 2xx or interrupted body read means **uncertain**, never “not saved.” No automatic retry. Explicit **Check/retry** sends the identical key, route and frozen body. An abandoned uncertain record requires a warning that the original may already have committed. A genuinely new identical purchase or next installment gets a new UUID after the prior action is resolved. One unresolved action blocks new Save/Pay in this account until resolution or explicit abandonment.

Navigation retains records; logout hides them without deleting or resending them. Reload or same-account reauthentication restores `sending` as `uncertain`; another account cannot recover them. A late response or `finally` can update only the originating account/session/action, never a newer one. Storage failure cannot silently turn a keyed write into an unkeyed one.

## Server contracts

`POST /api/transactions` already accepts account-scoped `Idempotency-Key` with explicit `spent_on`, atomic key+expense storage, same-key replay, changed-payload conflict and deleted-original tombstone. Ordinary Save will use it. Its unkeyed API remains unchanged.

`PATCH /api/schedules/{id}/pay` gains an opt-in keyed body containing `expected_paid_count`, `expected_amount_cents`, `expected_category_id`, `expected_name`, `expected_total_count`, `spent_on`. The route ID and frozen fields form a domain-separated canonical hash. Under one `BEGIN IMMEDIATE` transaction, an existing account key is checked first: matching hash plus an original expense still owned by the account and linked to this schedule returns its stored original result, even after a final loan installment closed the schedule. Changed payload or cross-kind key reuse is 409; deleted original is a replay-unavailable 409. For a new key, validate ownership, date, active state and unchanged displayed preconditions before creating one linked expense, incrementing `paid_count`, closing the final loan if applicable, and storing the response/key atomically. A fresh key with a stale display is 409, not a guessed repeat. The existing `transaction_requests` columns suffice; no migration. The unkeyed Pay request and response remain compatible.

## Read lifecycle and finite deadline

Every core request captures token and session epoch. A 401 can sign out only that still-current session. Every screen load has a generation, and state, DOM, cursor, busy button and toast changes after *every* await—including JSON body parsing—require the same account/session/screen/action generation. Superseded read cancellation is an optimization, not the correctness proof. A 10-second deadline covers headers and body. A timed-out or aborted financial write remains uncertain and is never automatically resent.

## Verification oracle

The browser tests must first capture failing traces before repair. For both Save and Pay, `route.fetch()` must let the real disposable-server write commit, then withhold/abort the reply; assert persisted transaction ID and payment count, uncertain UI, same frozen retry key/body, one stored result, and a distinct identity for the next genuine action. Cover final-loan replay, reload/same-account recovery, foreign-account hiding, storage failure and invalid success shape. For reads, control older/newer Month responses (including delayed JSON after headers), stale 401/error/success after signout and new login, a left screen, and stale busy cleanup. These are local regression results only; static checks, CI-plan output and owner UAT are separate evidence classes.
