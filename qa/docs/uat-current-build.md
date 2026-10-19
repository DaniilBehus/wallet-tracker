# Current-build owner UAT — handoff, not a result

[← Back to README](../../README.md#qa-evidence) · [Current QA status](../../docs/qa-status.md) · [Next: category-limit steps →](uat-category-limits.md)

**PENDING owner execution and decision.** The reference application source is
published `main` at [`7b1cb328`](https://github.com/DaniilBehus/wallet-tracker/commit/7b1cb328e1d90a52527b792fb3ef4d95cdd92948), with [six successful CI jobs](https://github.com/DaniilBehus/wallet-tracker/actions/runs/39248991256).
A later documentation-only commit does not re-run or sign these scenarios. Record
the actual running build below before starting. Automated tests and this
handoff are **not** an owner signature or release approval.

## Use only a disposable account and database

Use the coordinator-provided `http://127.0.0.1:3035` loopback URL if a server
is already running. **Do not start a second server on that port.** Otherwise,
from the Wallet repository with its already installed supported runtime and
dependencies, first verify port 3035 is free and the database path below does
not exist, then start one server in a separate PowerShell terminal:

```powershell
New-Item -ItemType Directory -Force qa/reports/uat-current | Out-Null
$env:DB_PATH = Join-Path (Get-Location) 'qa/reports/uat-current/wallet.db'
$env:JWT_SECRET = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
$env:WALLET_AI_MODE = 'off'
$env:WALLET_HOST = '127.0.0.1'
$env:PORT = '3035'
node src/server.js
```

Use a new file name if `wallet.db` already exists; **never overwrite or delete
an existing database** to prepare UAT. Do not use `npm start` here because it
may read a local `.env`. Register a synthetic account such as
`category-uat@example.test`; do not enter real spending or keys. Afterward,
stop only this server with Ctrl+C and close its terminal. Retain the ignored
test database until the owner decides whether it is needed for a defect report.

## Owner checklist

| Check | What to do and observe |
|---|---|
| Category limits | Run the existing [13-step script](uat-category-limits.md#steps) on the synthetic account. Record any mismatch by step number. A limit of `0` is real; clearing the input removes the limit. |
| Schedule edit | Create a synthetic schedule, use its Edit control to change name, amount and due day, save, reload Schedules and Upcoming. One schedule should remain with the edited values; Cancel/Escape should not save. Record any refusal or duplicate. This is the outstanding [BUG-021](../../log/BUGS.md) owner gate. |
| Expense editor keyboard | Create a synthetic expense, open its editor, use Tab/Shift+Tab through controls, then Escape. Focus should stay inside while open and return to the triggering row when closed. This is a human recheck of the [automated modal regression](test-report-modal-bind.md), not a full accessibility audit. |
| Month refresh | Open Month in two tabs of the same synthetic account. Add an expense in the second tab; reload the first tab or navigate away and back to Month. It should then show the new total and row once. Automatic live polling or an immutable pagination snapshot is **not** expected. |
| Uncertain Save/Pay response | If a lost response can be reproduced safely with browser network controls on this disposable account, record the exact steps and visible message. Do not press a new Save/Pay with a fresh request key just to “try again”; inspect whether one record/payment exists after recovery. If not reproducible, mark **NOT RUN**, not PASS. [Automated recovery evidence](test-report-write-lifecycle.md) is separate. |

The [monthly-limit UAT](uat-monthly-limit.md#second-run--the-owner-2026-09-24)
was accepted by the owner on its recorded older build. Preserve that historical
decision; do not copy its 11/11 result into the blank current-build record.
No live AI provider, personal database or external service is part of this UAT.

## Owner record — leave blank until actually performed

| Field | Owner entry |
|---|---|
| Actual build SHA and URL | |
| Date and reviewer | |
| Category-limit steps (1–13) | PENDING |
| Schedule edit / focus / Month refresh | PENDING |
| Uncertain response (PASS / FAIL / NOT RUN) | PENDING |
| Observations and defect links | |
| Decision (accept / reject / follow-up) | PENDING |

If any step fails, record the step, expected/actual behavior, build SHA and a
safe screenshot or trace without private data. The owner, not the agent,
records the acceptance decision.
