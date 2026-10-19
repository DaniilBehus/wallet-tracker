# CI-equivalent verification and retained evidence — local report

[← Back to README](../../README.md#qa-evidence) · [Run commands](../../docs/testing.md) · [Shared plan](../../scripts/verification-plan.js) · [Next: test plan →](test-plan.md)

Recorded 2026-10-10 on `b270355c8c850282b10cc0a7bdeb81c88b784765` plus local, uncommitted changes. This is **not** a GitHub Actions result, a full local CI PASS, owner UAT or live-model measurement.

## F16 finding and local change

The published baseline workflow lacked the race command while `npm test` omitted several CI suites. An earlier uncommitted change had added race to the API job, but the commands still had no single shared local/CI task inventory. Newman HTML/JUnit and Python JUnit were generated locally without corresponding CI retention steps. [BUG-032](../../log/BUGS.md) tracks that evidence gap.

The [shared plan](../../scripts/verification-plan.js) now defines six enforced groups and 18 tasks. The [runner](../../scripts/verify-ci.js) is used by both `verify:ci` and one invocation in each existing CI job. It preserves the existing dependency graph and offline suites; `npm test` remains a legacy subset. k6 and live-model evaluation are explicitly outside this enforced plan. `--plan` is read-only inspection: all 18 tasks say `NOT_RUN`. Unknown, duplicate or empty group selections fail. There is no skip-to-green switch. A failed, signalled or missing child stops execution and leaves later tasks `NOT_RUN`.

The runner launches the established scripts directly, so local verification does not invoke the package's `.env`-loading Newman command. Child environments keep runtime necessities including `PYTHON`, but drop inherited external API URLs, provider keys and real database paths. Offline/loopback test runners retain their own disposable storage. A run summary is written under ignored `qa/reports/verification/<unique-run-id>/summary.json`; it records task IDs/statuses/exit codes, HEAD, dirty flag, source-content fingerprint and numeric CI run/attempt if present. It does **not** store command output, raw stderr, credentials, environment values, personal paths or test bodies. The fingerprint hashes Git-listed tracked and non-ignored untracked file contents **at invocation**, not ignored files, installed dependencies, environment, full history or later edits. The local group summaries therefore identify their invocation snapshots, not this later report text.

## Actual local outcomes

| Execution | Observed outcome |
|---|---|
| `verify:ci -- --plan` | 18 tasks `NOT_RUN`; no tests executed. |
| Default `verify:ci` | **FAIL**: local `gitleaks` executable unavailable; history secret scan failed to start, remaining 17 tasks `NOT_RUN`. Nothing was installed or waived. |
| API group | **PASS 10/10 tasks**: at that execution, verification controls 7/7, gate controls 31/31, dates 4/4, self-check 8/8 with zero skips, OpenAPI 21/21 operations and 298 local refs, contract 15/15 with 340 validated real HTTP responses, DB 6/6, import 11/11, Newman 274 requests/945 assertions/zero failed scripts, and race 120 pairs per scenario with zero enforcing violations. Race D measured 120/120 duplicate unkeyed retries; it is not an idempotency PASS. |
| Python group | **PASS 1/1 task**, 27/27 pytest items. |
| Final focused controls | **9/9 PASS** after two additional artifact/evidence failure controls were added. These two controls were **not** in the earlier API-group execution. |
| Secret, Playwright/accessibility, Selenium, offline-AI/browser groups | Not run as groups in this slice. The default run stopped at the missing secret-scan prerequisite; no full-plan PASS is claimed. |

The API run retained allowlisted `api-report.html`, `api-junit.xml` and `race-summary.json`; the Python run retained `python-junit.xml`. The controls show a missing or unsafe producer report cannot turn a successful task green; distinct runs get distinct summary directories; failing/missing/signalled children and unwritable evidence locations do not pass. The runner records absent diagnostics as `ABSENT` or `NOT_RUN` and warns when their producer was not reached. It does not sweep older reports. Current local report samples were screened for JWT-shaped strings, long bearer values, listed credential assignments, Windows user paths and non-example email; the staged copies passed this focused screen. Such pattern checks cannot prove arbitrary report content harmless, and no raw reports are put into the compact summary.

## CI preparation, not remote proof

The edited workflow still has secret scan → API → Python → browser/Selenium and API → AI dependencies. Each job calls its exact shared group. `actions/upload-artifact@v4` is retained, with [version-specific supported inputs](https://github.com/actions/upload-artifact/tree/v4#inputs). Upload steps use `if: ${{ !cancelled() }}`, seven-day retention and names containing job, run ID and attempt. The API/Python uploads include only the runner's staged allowlisted reports and compact summary; race JSON is included. Browser/Selenium/AI failure traces remain on their prior failure-only policy, now with unique names. No whole workspace, `.env`, database or hidden-file upload is configured. An absent optional diagnostic is not interpreted as a passing producer.

This workflow has **not** been pushed or run on GitHub. `gitleaks` and `actionlint` are not installed locally and were not downloaded. Browser, AI and secret jobs need their own future authorized execution; upload behavior and full-tree CI status require a later actual GitHub run. A successful API or Python subset is not equivalent to that release gate.

## Exact local file scope

New: `scripts/verification-plan.js`, `scripts/verify-ci.js`, `qa/verify/verify-ci.test.js`, and this report. Extended existing files: `.github/workflows/ci.yml`, `package.json`, `docs/testing.md`, `qa/docs/test-plan.md`, `log/BUGS.md`. The other 22 files in the earlier 27-file accepted snapshot retained their expected hashes; these five existing paths are the allowed overlaps. No application, date, AI, race or prior gate implementation was changed in this slice. Nothing was staged, committed or pushed.

## Review addendum — workflow control

The earlier **9/9** focused controls passed on the actual LF workflow, but their dependency predicate could read `needs: python` from a *later* job when only E2E was changed to `needs: api`. It also rejected an equivalent CRLF checkout. These are defects in the static regression control, **not** observed errors in the current workflow. Two new tests, exercising the same inspection helper as the actual workflow check, first produced **9 pass / 2 fail** on that old predicate. The helper now bounds inspection to the named job, tolerates LF/CRLF, and refuses unsupported or ambiguous dependency syntax. The final focused suite is **12/12 PASS**, including a separate ambiguous-form control. The earlier API group ran seven controls; its historical PASS and the later nine-control result are not relabelled as a twelve-control API run. No real API, Python, browser, AI or secret group was rerun for this documentation/test-only correction.

Remaining non-blocking limits are explicit. Removing a tracked file can make source-identity construction fail **before** a summary is written; it cannot become PASS. The wrapper has no child-level timeout, so a hanging child may delay the verdict. The fingerprint describes only invocation-time listed source, and ordinary local browser settings may differ from CI-only settings. Artifact privacy screening is heuristic, not a proof against every possible sensitive value. These are not repaired or presented as exercised coverage here. Full local verification, remote uploads and GitHub CI remain unverified; BUG-032 stays in progress pending publication and a real run.

**Line-ending fixture follow-up:** a read-only virtual CRLF view of the same workflow initially produced **10 pass / 2 fail**: the wrong-E2E and ambiguous-form mutation tests searched raw LF delimiters before calling the dependency helper. The helper itself accepted CRLF. The fixture now normalizes before locating/replacing the E2E `needs` line and then tests both LF and CRLF encodings without doubling carriage returns. Final selected controls: **12/12 PASS** on the actual workflow and **12/12 PASS** on the virtual CRLF view. Both negative mutations retain their original assertions in each encoding. No workflow file was rewritten, no real groups were rerun, and remote CI/upload verification remains pending.
