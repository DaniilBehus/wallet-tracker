# Validator controls and race database ownership — 2026-10-09

[← Back to README](../../README.md#qa-evidence) · [Run commands](../../docs/testing.md) · [Race runner](../race/run.js) · [Negative controls](../gates/validator-controls.test.js)

Build under test: `b270355c8c850282b10cc0a7bdeb81c88b784765` plus the local, uncommitted changes described here. This is local evidence, not a GitHub Actions result or a production-load test.

## Confirmed defects and repair

| Defect | Before | Local repair |
|---|---|---|
| [BUG-023](../../log/BUGS.md) | E reported one violation, yet the runner exited 0 and printed success. | One scenario registry builds both summary and verdict; E is enforced. Every scenario must supply the expected observed pair count. |
| [BUG-024](../../log/BUGS.md) | Missing architecture note yielded C1 SKIP and exit 0. Empty source/UI inventories could pass by zero iteration. | Required files and nonempty inventories fail. Genuinely optional platform checks are outside these eight required gates. |
| [BUG-025](../../log/BUGS.md) | An in-memory filesystem sentinel named like another race run was removed by the prefix sweep. | Allocate a unique owned directory; resolve and validate it before removing only that directory after child shutdown. Preserve it and fail if shutdown/cleanup is incomplete. |

The controls exercise the actual runner `main` and actual self-check/coverage functions through an in-memory filesystem/server seam. No real architecture file, collection, source tree or database was renamed/deleted for negative cases. The final controls were also run against the unchanged `b270355` source via read-only `git show`, without switching the checkout: **5 passed, 18 failed**. The failures include the true false-green cases (E-only exit 0, missing C1 input, zero execution evidence and cross-run sentinel deletion); controls for newly introduced owned-directory behavior naturally fail because that mechanism does not exist in the baseline. The changed source passes **23/23**. A positive control has all enforcing scenarios clean while D reports a duplicate; it exits 0. Every A/B1/B2/B3/C/E violation alone exits 1. Every A/B1/B2/B3/C/D/E empty outcome alone exits 1. Invalid `RACE_PAIRS` values `0`, `-1`, `NaN`, `1.5` fail before scenario execution. Separate controls prove that incomplete child shutdown preserves the owned DB, changed directory identity refuses cleanup, and a physical disposable fixture keeps an unrelated sentinel.

## Real local verification

- `npm run test:gates`: 23/23 passed.
- `npm run check`: 8 pass, 0 skip, 0 fail.
- `npm run check:openapi`: 21/21 source operations and 298 local references.
- `npm run test:race`: 120 pairs each in A, B1, B2, B3, C, D and E; all six enforcing scenarios have **0 violations**. D measured **120/120 duplicate rows** from unkeyed double POST. Summary verdict `PASS`; its unique owned database directory was removed after both processes stopped.

The runner still uses fixed ports 3110/3111, so two real runs cannot execute concurrently. Its compact ignored `qa/reports/race-summary.json` is local; no database, `.env`, or broad report directory is uploaded by CI. The workflow change places `test:gates` before the heavier API suites and `test:race` after Newman in the existing API job. **CI has not verified this uncommitted change.** No application route, money logic or dependency was changed in this slice.
