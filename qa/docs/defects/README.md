**English** · [Slovenčina](../../../locales/sk/qa/docs/defects/README.md)

# Full QA findings

[← Back to README](../../../README.md#qa-evidence) · [Current-status register](../../../log/BUGS.md) · [Next: test plan →](../test-plan.md)

There is one complete report for every recorded BUG, LIMIT and TRACE-AUDIT ID. The [register](../../../log/BUGS.md) alone owns current status; these reports preserve the original observation and dated investigation. An unrecorded environment, frequency, priority or root cause remains explicitly unknown. The archive of the pre-redesign register is [here](../../../log/BUGS-archive-before-2026-10-26.md).

| ID / full report | Recorded problem or boundary | Type |
|---|---|---|
| [BUG-001](BUG-001-save-button-contrast.md) | Save button invisible — white text on white background | Defect |
| [BUG-002](BUG-002-paid-loan-counter.md) | A fully paid loan still shows one instalment left | Defect |
| [BUG-003](BUG-003-pay-button-stuck.md) | Pay button stays on its busy label after a refused payment | Defect |
| [BUG-004](BUG-004-bcrypt-blocks-event-loop.md) | 20 wrong passwords a second make the app unusable for everyone | Defect |
| [BUG-005](BUG-005-e2e-timeout-on-slow-runs.md) | One e2e test times out on runs that are ~3× slower than normal | Defect |
| [BUG-006](BUG-006-load-runner-exit-127.md) | The load runner returned 127 after a run where every threshold passed | Defect |
| [BUG-007](BUG-007-test-script-never-ran.md) | A test script never ran, and the suite reported it as green | Defect |
| [BUG-008](BUG-008-api-runner-exit-127.md) | The API runner exits 127 on a green run, so the first CI build would be red | Defect |
| [BUG-009](BUG-009-segfault-on-node-20.md) | The server segfaults on Node 20 in CI, so the first build was red | Defect |
| [BUG-010](BUG-010-runner-green-on-no-server.md) | The API runner exits 0 when the server never starts, so CI called it green | Defect |
| [BUG-011](BUG-011-startup-database-lock.md) | Two servers started at once on one database, and one dies at boot | Defect |
| [BUG-012](BUG-012-deferred-transaction-500.md) | Two processes writing one database answer 500 | Defect |
| [BUG-013](BUG-013-mobile-edit-overlay.md) | The edit panel opened underneath the bottom navigation | Defect |
| [BUG-014](BUG-014-short-phone-categories.md) | Categories collapse to an 18 px strip on a short phone | Defect |
| [BUG-015](BUG-015-uncategorised-expense-edit.md) | Editing an uncategorised expense sends category zero | Defect |
| [BUG-016](BUG-016-registration-race.md) | Concurrent registrations of the same email return 500 | Defect |
| [BUG-017](BUG-017-password-byte-limit.md) | Password suffixes after 72 bytes are silently ignored | Defect |
| [BUG-018](BUG-018-loan-cent-precision.md) | A large loan loses an integer cent in remaining money | Defect |
| [BUG-019](BUG-019-oversized-json-error.md) | Oversized JSON is reported as an internal server failure | Defect |
| [BUG-020](BUG-020-early-year-dates.md) | Valid early-year dates produce malformed next dates | Defect |
| [BUG-021](BUG-021-schedule-edit-ui.md) | Schedules cannot be edited through the interface | Defect |
| [BUG-022](BUG-022-modal-focus-trap.md) | Expense overlay does not contain keyboard focus | Defect |
| [BUG-023](BUG-023-race-verdict.md) | Registration-race violation was ignored by final verdict | Defect |
| [BUG-024](BUG-024-required-gate-inputs.md) | Required validator inputs could disappear with a green result | Defect |
| [BUG-025](BUG-025-race-cleanup-ownership.md) | Race cleanup could remove another run's database | Defect |
| [BUG-026](BUG-026-api-pagination-validation.md) | Unsafe pagination and IDs bypassed validation | Defect |
| [BUG-027](BUG-027-json-text-conversion.md) | Non-convertible note/icon JSON returned internal errors | Defect |
| [BUG-028](BUG-028-evaluator-setup-race.md) | Concurrent evaluator setup can abort before quota exercise | Defect |
| [BUG-029](BUG-029-evaluator-report-collision.md) | Concurrent evaluator reports can overwrite each other | Defect |
| [BUG-030](BUG-030-static-exception-validation.md) | Stale or redundant static-gate exceptions passed C9 | Defect |
| [BUG-031](BUG-031-static-coverage-wording.md) | Static inventory gate wording overstated runtime coverage | Defect |
| [BUG-032](BUG-032-ci-evidence-retention.md) | CI and local verification diverged; reports were not retained | Defect |
| [BUG-033](BUG-033-e2e-database-isolation.md) | Main E2E reused one database between runs and ignored DB_PATH | Defect |
| [BUG-034](BUG-034-node-native-runtime-floor.md) | Declared Node 22 floor could load a SQLite binding requiring Node-API 10 | Defect |
| [BUG-035](BUG-035-pagination-drift.md) | Offset paging can duplicate or skip expenses after another client's write | Defect |
| [TRACE-AUDIT-001](TRACE-AUDIT-001-semantic-links.md) | Public semantic traceability drift | Audit finding |
| [LIMIT-001](LIMIT-001-serialised-database-work.md) | Every request queues behind database work — 23× slower under write load | Accepted limit |
| [LIMIT-002](LIMIT-002-unkeyed-duplicate-post.md) | The same POST twice creates two expenses (unkeyed requests; keyed saves replay — D-035) | Accepted limit |
