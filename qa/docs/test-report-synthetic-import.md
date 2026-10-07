# Synthetic import and Selenium — local regression note

[← Back to README](../../README.md) · [Import analysis](analysis-synthetic-import.md) · [Next: import tests →](../import/provider-adapter.test.js)

Recorded 2026-10-07 on `work/claude-wallet-2026-09-24`, starting at `2a86d3fb18e44da82587ccd32994c2297c88842a`. This is an agent-run local check, not owner UAT or a new GitHub CI result. No real provider, account or model was used.

## Selenium TC-SEL-009

The historical second-save timeout did **not reproduce** in one focused run (1/1). Source ordering gives a plausible race: `submitCategoryLimit` closes the dialog before awaiting `loadMonth()`, while `withBusy` keeps the save button disabled and `state.busy` true until that refresh finishes. The page-object helper previously returned as soon as the dialog was hidden, so its next operation could begin before the prior save finished. It now also waits for the same button to be re-enabled. This is an observable completion condition, not a fixed sleep, timeout increase or relaxed business assertion. After that change, focused TC-SEL-009 passed 1/1 and the full Selenium suite passed 11/11. The original timeout's cause remains **unproven**; do not call it fixed.

Reproduce the checks with `npm run test:selenium -- -k test_category_editor_sets_reaches_and_clears_its_own_limit -vv -s` and `npm run test:selenium`. Selenium's failure hook saves screenshot, page source and browser console under ignored `qa/reports/selenium/` when a test fails; each new run resets that folder.

## Import coverage

Existing offline tests already cover read-only preview, all-or-nothing rejection after an earlier valid record, changed-identity conflict, lost-response replay without a duplicate, per-user category/identity isolation, invalid JSON/field types, upstream denial, timeout, redirect and byte/count limits. Two absent upstream-shape checks were added to the existing failure table: an empty record list and duplicate external IDs. Both must return `INVALID_RESPONSE` without any Wallet transaction or request-ledger write. No import policy, route or save path changed.

`npm run test:import` passed 11/11; `npm run check` passed 8/8. The edited JavaScript and Python files passed syntax checks. These results are local only; the test-only loopback adapter is not a product connector.
