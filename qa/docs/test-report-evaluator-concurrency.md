# Evaluator concurrency — local QA evidence, 2026-10-10

[← Back to README](../../README.md#qa-evidence) · [AI test commands](../../docs/testing.md) · [Regression controls](../ai/tests/eval-concurrency.test.js) · [Window controls](../ai/tests/eval-window.test.js)

This is an **uncommitted local** evaluator fix, not a live-model result, owner UAT or GitHub CI run. Tests used disposable SQLite databases, copied source roots, synthetic users, loopback provider fakes and the offline network guard. No real provider or application database was used.

## Controlled failures before the fix

The evaluator previously looked up a stable synthetic email, inserted the user and initialized categories as separate operations. A copied evaluator synchronized three children before their first get-or-create. Two reported `UNIQUE constraint failed: users.email` before provider dispatch. An early version of this test barrier also ran on the second row and timed out; the durable control now enters it **once per child**. This experiment proves the race mechanism, **not** that it caused the earlier failed full AI run, whose child errors were not retained.

In a separate copied evaluator, an injected error immediately after default-category seeding left **one user and ten categories** before the fix. This showed that failure did not roll back the whole initialization. With a fixed start timestamp, two concurrent runs also printed the **same report path**; one pair could replace the other's evidence.

## Local changes and after-checks

User lookup, creation, default/custom category initialization and category read now run in one synchronous `BEGIN IMMEDIATE` transaction. The per-process cache receives only its committed result. The transaction ends before provider work. Stable email derivation and normal quotas were not changed.

Each report name now includes a random run identity. Complete temporary JSON and Markdown files are published to exclusive final names; a second-link error removes files owned by that attempt and does not print a `report:` success line. The convenience `*-latest.md` view identifies one completed immutable Markdown report by filename and retains the rendered content for readers. It means **last completed writer**, not latest chronological start. The two files are not a single atomic filesystem transaction; a process interruption between their individual links can still need cleanup. If the convenience view cannot update, the completed pair remains and a warning is printed.

The four new focused controls passed **4/4**: one complete user with ten categories under concurrent setup; rollback to zero user/category rows on injected seed failure; two distinct complete report pairs under a fixed clock; and cleanup/no success announcement on an injected second-file publication failure. Together with existing report/window controls, the affected run passed **25/25**. W9 still requires at most five rolling requests, one reservation per request, reported-call equality and at least one refusal when six calls are planned. It now separately names unexpected child exit 2, signal or missing exit code rather than letting aborted setup masquerade as quota exercise.

## Combined local validation

| Command | Observed result |
|---|---|
| `npm run test:ai` | 240 passed, 1 skipped, 0 failed (241 total); the skipped Windows file-symlink control requires extra privilege |
| `npm run eval:ai` | 116/116 fixture rows; `MODEL_QUALITY=NOT_MEASURED` |
| `npm run test:gates` / `npm run check` | 23/23 controls; 8/8 checks, 0 skipped |
| `npm run check:openapi` / `npm run test:contract` | 21/21 operations, 298 refs; 14/14 tests and 335 validated real loopback HTTP responses |

The earlier full AI run that failed at W9 remains a historical **failure**. The controlled setup race explains a possible failure shape, not that run's unrecorded cause. No browser suites, remote CI or live model quality were measured here. Other audit findings remain separate.
