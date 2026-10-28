**English** · [Slovenčina](../locales/sk/log/BUGS.md)

# Defect, limit and traceability register

[← Back to README](../README.md#qa-evidence) · [Full report index](../qa/docs/defects/README.md) · [Next: QA status →](../docs/qa-status.md)

This is the **single current-status register** for 35 defects, two accepted design limits and one traceability-audit finding. Each ID links to one full report. A full report preserves the dated investigation; if an old paragraph says `IN PROGRESS` or “uncommitted,” read it as historical, not as today's Git state. The complete pre-redesign register is retained [without lost observations](BUGS-archive-before-2026-10-26.md). No test was rerun for this documentation migration.

Severity and priority are separate: severity is recorded here where applicable; priority is reported only if it was separately recorded. `LIMIT` is not a defect, and the traceability audit is a documentation finding. A green unrelated CI run does not close an uncharacterised failure.

## Current register

| ID / full report | Problem or boundary | Severity | Status | Recorded fix disposition |
|---|---|---|---|---|
| [BUG-001](../qa/docs/defects/BUG-001-save-button-contrast.md) | Save button invisible — white text on white background | High | **CLOSED** | fixed |
| [BUG-002](../qa/docs/defects/BUG-002-paid-loan-counter.md) | A fully paid loan still shows one instalment left | High | **CLOSED** | fixed |
| [BUG-003](../qa/docs/defects/BUG-003-pay-button-stuck.md) | Pay button stays on its busy label after a refused payment | Medium | **CLOSED** | fixed |
| [BUG-004](../qa/docs/defects/BUG-004-bcrypt-blocks-event-loop.md) | 20 wrong passwords a second make the app unusable for everyone | High | **CLOSED** | fixed |
| [BUG-005](../qa/docs/defects/BUG-005-e2e-timeout-on-slow-runs.md) | One e2e test times out on runs that are ~3× slower than normal | Low | **OPEN** | — |
| [BUG-006](../qa/docs/defects/BUG-006-load-runner-exit-127.md) | The load runner returned 127 after a run where every threshold passed | Low | **CLOSED** | fixed |
| [BUG-007](../qa/docs/defects/BUG-007-test-script-never-ran.md) | A test script never ran, and the suite reported it as green | Medium | **CLOSED** | fixed |
| [BUG-008](../qa/docs/defects/BUG-008-api-runner-exit-127.md) | The API runner exits 127 on a green run, so the first CI build would be red | High | **CLOSED** | fixed |
| [BUG-009](../qa/docs/defects/BUG-009-segfault-on-node-20.md) | The server segfaults on Node 20 in CI, so the first build was red | High | **CLOSED** | fixed |
| [BUG-010](../qa/docs/defects/BUG-010-runner-green-on-no-server.md) | The API runner exits 0 when the server never starts, so CI called it green | Critical | **CLOSED** | fixed |
| [BUG-011](../qa/docs/defects/BUG-011-startup-database-lock.md) | Two servers started at once on one database, and one dies at boot | Medium | **CLOSED** | fixed |
| [BUG-012](../qa/docs/defects/BUG-012-deferred-transaction-500.md) | Two processes writing one database answer 500 | High | **CLOSED** | fixed |
| [BUG-013](../qa/docs/defects/BUG-013-mobile-edit-overlay.md) | The edit panel opened underneath the bottom navigation | Medium | **CLOSED** | fixed |
| [BUG-014](../qa/docs/defects/BUG-014-short-phone-categories.md) | Categories collapse to an 18 px strip on a short phone | High | **CLOSED** | published in `2face59` |
| [BUG-015](../qa/docs/defects/BUG-015-uncategorised-expense-edit.md) | Editing an uncategorised expense sends category zero | Medium | **CLOSED** | a399e79 |
| [BUG-016](../qa/docs/defects/BUG-016-registration-race.md) | Concurrent registrations of the same email return 500 | High | **CLOSED** | e291ea9 |
| [BUG-017](../qa/docs/defects/BUG-017-password-byte-limit.md) | Password suffixes after 72 bytes are silently ignored | High | **CLOSED** | 53b310b |
| [BUG-018](../qa/docs/defects/BUG-018-loan-cent-precision.md) | A large loan loses an integer cent in remaining money | Critical | **CLOSED** | bd516ac |
| [BUG-019](../qa/docs/defects/BUG-019-oversized-json-error.md) | Oversized JSON is reported as an internal server failure | Medium | **CLOSED** | published in `2face59` |
| [BUG-020](../qa/docs/defects/BUG-020-early-year-dates.md) | Valid early-year dates produce malformed next dates | Medium | **CLOSED** | published · CI verified |
| [BUG-021](../qa/docs/defects/BUG-021-schedule-edit-ui.md) | Schedules cannot be edited through the interface | High | **CLOSED** | published · CI · owner UAT |
| [BUG-022](../qa/docs/defects/BUG-022-modal-focus-trap.md) | Expense overlay does not contain keyboard focus | Medium | **CLOSED** | published · CI verified |
| [BUG-023](../qa/docs/defects/BUG-023-race-verdict.md) | Registration-race violation was ignored by final verdict | High | **CLOSED** | published · CI verified |
| [BUG-024](../qa/docs/defects/BUG-024-required-gate-inputs.md) | Required validator inputs could disappear with a green result | High | **CLOSED** | published · CI verified |
| [BUG-025](../qa/docs/defects/BUG-025-race-cleanup-ownership.md) | Race cleanup could remove another run's database | Medium | **CLOSED** | published · CI verified |
| [BUG-026](../qa/docs/defects/BUG-026-api-pagination-validation.md) | Unsafe pagination and IDs bypassed validation | High | **CLOSED** | published · CI verified |
| [BUG-027](../qa/docs/defects/BUG-027-json-text-conversion.md) | Non-convertible note/icon JSON returned internal errors | High | **CLOSED** | published · CI verified |
| [BUG-028](../qa/docs/defects/BUG-028-evaluator-setup-race.md) | Concurrent evaluator setup can abort before quota exercise | High | **CLOSED** | published · CI verified |
| [BUG-029](../qa/docs/defects/BUG-029-evaluator-report-collision.md) | Concurrent evaluator reports can overwrite each other | High | **CLOSED** | published · CI verified |
| [BUG-030](../qa/docs/defects/BUG-030-static-exception-validation.md) | Stale or redundant static-gate exceptions passed C9 | Medium | **CLOSED** | published · CI verified |
| [BUG-031](../qa/docs/defects/BUG-031-static-coverage-wording.md) | Static inventory gate wording overstated runtime coverage | Medium | **CLOSED** | published · static wording verified |
| [BUG-032](../qa/docs/defects/BUG-032-ci-evidence-retention.md) | CI and local verification diverged; reports were not retained | Medium | **CLOSED** | published · CI artifacts verified |
| [BUG-033](../qa/docs/defects/BUG-033-e2e-database-isolation.md) | Main E2E reused one database between runs and ignored DB_PATH | Medium | **CLOSED** | published · CI verified |
| [BUG-034](../qa/docs/defects/BUG-034-node-native-runtime-floor.md) | Declared Node 22 floor could load a SQLite binding requiring Node-API 10 | High | **CLOSED** | published · CI verified |
| [BUG-035](../qa/docs/defects/BUG-035-pagination-drift.md) | Offset paging can duplicate or skip expenses after another client's write | Medium | **CLOSED** | published · CI verified |
| [TRACE-AUDIT-001](../qa/docs/defects/TRACE-AUDIT-001-semantic-links.md) | Public semantic traceability drift | — | **CLOSED** | published · static links verified |
| [LIMIT-001](../qa/docs/defects/LIMIT-001-serialised-database-work.md) | Every request queues behind database work — 23× slower under write load | — | **ACCEPTED** | — |
| [LIMIT-002](../qa/docs/defects/LIMIT-002-unkeyed-duplicate-post.md) | The same POST twice creates two expenses (unkeyed requests; keyed saves replay — D-035) | — | **ACCEPTED** | — |

## Current dispositions — 2026-10-19

This dated reconciliation is preserved in the [original register archive](BUGS-archive-before-2026-10-26.md#current-dispositions--2026-10-19). It is the source of the current-status values above for the application built at `7b1cb328` and its specific evidence, not a claim that this documentation edit ran the product. Later owner UAT for BUG-021 and published CI evidence are cited in its [full report](../qa/docs/defects/BUG-021-schedule-edit-ui.md). BUG-005 remains **OPEN locally with an unproved cause**; public Issue #5 is closed and retains a contradictory `state:open` label. The proposed metadata correction is private and **has not been applied**.

## Historical evidence and interpretation

- [Complete original register and dated addenda](BUGS-archive-before-2026-10-26.md): all pre-redesign observations, measurements, comments, and dates remain available.
- [QA status](../docs/qa-status.md) separates local test evidence, published CI, owner UAT, and accepted gaps.
- [Test plan](../qa/docs/test-plan.md) defines the developer, release, and owner-UAT gates.

Only this page is the documentation status authority. Full reports show their migration-time status for context; if an external Issue or dated paragraph disagrees, reconcile the evidence before changing this register.
