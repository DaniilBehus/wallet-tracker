**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-qa-policy-status.md)

# F20/F21 QA policy and status correction — local documentation report

[← Back to README](../../README.md#qa-evidence) · [Current QA status](../../docs/qa-status.md) · [Test plan](test-plan.md) · [Next: defect register →](../../log/BUGS.md)

As of 2026-10-13, this is a **documentation-only, uncommitted local correction** on branch `work/claude-wallet-2026-09-24`, committed base `b270355c8c850282b10cc0a7bdeb81c88b784765`. It does not close a defect, certify a release, record owner UAT, or verify a new remote CI run. The [living status index](../../docs/qa-status.md) should be rechecked against later source, Git and CI; old run reports keep their original dates and results.

## Changes within the ordered scope

| File | Correction |
|---|---|
| [`qa/docs/test-plan.md`](test-plan.md) | Separates developer/local regression, exact-SHA release acceptance and owner UAT. A dirty local tree can be tested with named base/source hashes; a test/fixture/oracle repair may be valid with independent expected behavior and unweakened assertions. Unresolved Critical/High `OPEN` **or** `IN PROGRESS` blocks release absent an explicit recorded owner exception. BUG-021 remains High/OPEN. The entry/exit numbering is sequential. Shared E2E process/database/IP limiter and separate historical k6 measurement are stated honestly. |
| [`docs/testing.md`](../../docs/testing.md) | Replaces the seven-import-test and absent-adapter claims with links to the current offline batch and loopback-adapter tests. The adapter is a test demonstrator, not a product provider connector. A local committed workflow change is no longer called uncommitted; no fresh remote run is inferred. Undated command-comment counts are removed in favor of generated run reports. |
| [`qa/docs/accessibility-baseline.md`](accessibility-baseline.md) | Adds only a current-state supersession pointer before the untouched dated baseline. Escape/focus restoration is committed; full modal containment and contrast remain unproven. |
| [`docs/analysis/database.md`](../../docs/analysis/database.md) | Aligns source/coverage text with the dated category publication proof while retaining unsigned owner UAT. |
| [`docs/qa-status.md`](../../docs/qa-status.md) | New source-bounded index for local base, uncommitted changes, historical publication, no new exact-SHA combined-tree CI, F19, BUG-005/021/022, readiness uncertainty and owner UAT. |
| [`README.md`](../../README.md) | One link to the current-status index in the existing QA navigation. |
| [`log/BUGS.md`](../../log/BUGS.md) | Adds a marked top notice and a marked bottom correction; original rows, reports, states and historical words remain byte-identical after stripping only those two additions. |
| This report | Records the changes, checks and limits without altering dated run evidence. |

## Commit facts, with boundaries

- Bounded local `git log -S` and committed-blob inspection placed the short-phone CSS and `entity.too.large` → 413 response in public-ready root commit `2face59`. Their `S23 · uncommitted` phrases in the historical defect record described the earlier recording time; the register now adds a pointer instead of rewriting that provenance.
- Local HEAD `b270355` (`test: add accessibility regression and failure evidence`) includes `public/app.js`, the accessibility specs and `.github/workflows/ci.yml`; its committed workflow contains the accessibility command. That is source inclusion, not evidence that the **uncommitted combined tree** has a green GitHub run or uploaded artifacts.
- The [dated 2026-09-29 publication proof](../../docs/analysis/README.md#dated-publication-evidence--2026-09-29) records successful CI for `ed22c71`, not for this later tree. The [category UAT](uat-category-limits.md) remains unsigned.

## Checks and limits

After the edits, on the local source tree:

| Read-only/focused check | Observed result |
|---|---|
| `node scripts/check.js` using local Node 22.14.0 | 8 pass, 0 skip, 0 fail; static invariants only |
| `node --test qa/gates/traceability.test.js` | 21 pass, 0 fail, 0 skip; in-memory controls only |
| `node scripts/traceability.js` | Static PASS for the existing catalogue; no semantic or execution claim, and F19 remains separate |
| Relative Markdown link-target check over the changed existing/new documents | 259 local targets checked, 0 missing after correcting one report link; this checks filesystem targets, not every GitHub anchor or remote URL |
| Additive-history readback | After removing only the marked notice/addendum, `log/BUGS.md` SHA-256 is `41771ab1a063072eac0a06f671cdc54a027fa863794c841afa339093c2bdd7cf`, matching the frozen prior file. After removing only the new pointer, the accessibility baseline SHA-256 is `fed051ee997f51731039f08954df003af02bf23c1a9bd2373c9dd76376bc80d2`, matching its prior file. |
| Scope and whitespace | All 49 other frozen source hashes match their baseline; Git status contains only the pre-existing 53 paths, the two separately frozen existing documents and the two new ordered files. Index empty; `git diff --check` exits 0; both new Markdown files have no trailing whitespace. |

Full suites, server/browser, database, provider, network, remote CI, owner UAT, Git commit and push were **not** run or performed in this documentation task. [BUG-005's](defects/BUG-005-e2e-timeout-on-slow-runs.md) cause and the earlier [readiness timeout](test-report-runtime.md) remain unexplained. This report is not an exception to the release blocker for BUG-021 or any other unresolved High/Critical finding. F19's executable inventory remains incomplete, and no owner skill claim is promoted.
