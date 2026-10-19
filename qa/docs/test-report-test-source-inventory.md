# Current test-source inventory — 2026-10-15

The initial ORD-106 record below is retained as historical evidence. Its claim that all new executable paths failed closed was **superseded** by the ORD-107 discovery findings and the dated ORD-108 correction at the end of this report.

[← Back to README](../../README.md#qa-evidence) · [Derived inventory](test-source-inventory.json) · [Case catalogue](test-cases.md)

## Scope and result

**STATIC_SOURCE_INVENTORY / NOT_RUN.** The [checker](../../scripts/test-source-inventory.js) composes the already accepted [API source inventory](postman-api-inventory.json) with a [reviewed manifest](../traceability/test-source-manifest.json) of the remaining test sources. It does not import or execute test modules to discover cases. The current result has a source declaration for every one of the **280 distinct main catalogue IDs**:

| Main family | Cases | Source boundary |
| --- | ---: | --- |
| API | 141 | Existing Postman aggregate; 271 collection nodes are a different count. |
| Browser E2E + regressions | 90 + 3 | Main `qa/e2e/*.spec.js` files, excluding synthetic import and separate AI. |
| Python + Selenium | 17 + 9 | Explicit `@case` and `pytest.param(...marks=case(...))` declarations. |
| Database + contract + load | 6 + 11 + 3 | Migration/contract declarations and three runner-linked k6 scripts. |

The checker enumerates **137** current JS/Python paths under `qa/` and `scripts/`. Each has a distinct role, a reviewed LF-normalized whole-file SHA-256, and any literal test declarations or main-case links. It accounts for **20 explicit parameter/viewport identities**, including three security payload IDs, the Python validation table, Selenium desktop/phone and limit variants, and four AI-layout viewports. A parameter/runtime instance is not another catalogue ID. The security loop has one literal test declaration but three separately linked catalogue IDs.

Sources outside the main catalogue stay separate: 26 AI source files hold 249 literal source declarations linked to the existing [AI case register](ai-test-plan.md), without claiming that each declaration semantically satisfies a register case; two [accessibility](accessibility-baseline.md) sources hold six declarations; three synthetic-import source files hold 14 provisional declarations. The contract file also has one provisional import scenario and three named DATE/VALIDATION supporting controls alongside its 11 main contract cases. Another 14 supporting-control files have 129 literal declarations; runners, fixtures, page objects and tooling are named per file in the manifest. The [synthetic import analysis](analysis-synthetic-import.md) remains provisional: no real bank/provider integration or owner approval is inferred.

## Fail-closed checks and shared plan

The manifest pins exact paths and source bytes. New, deleted, moved or edited executable files, an unannotated test added to a pinned file, changed catalogue row, missing main link, duplicate/unknown/wrong-family ID, removed support file, missing parameter expansion, altered separate role/register pointer, malformed manifest and stale generated JSON fail. The checker accepts reviewed many-to-many links and LF/CRLF-equivalent source text. Its supported declaration forms are **literal one-line JS `test()`/`it()` titles and Python `def test_...` names**; loop and parameter expansions are explicitly recorded, not inferred by a general JS/Python parser. Exact hashes are identity evidence, not an oracle for expected behavior.

The shared [verification plan](../../scripts/verification-plan.js) now schedules F13 traceability, the complete API `--check`, this source-inventory `--check`, and their pure controls before the existing runtime tasks in the API group. [CI orchestration controls](../verify/verify-ci.test.js) reject an omitted, weakened, duplicated or delayed gate. Existing Newman, race, artifacts, workflow dependencies and other tasks were preserved; CI already invokes this shared API group. **Only `--plan` was run here; remote CI and the full API group were not run.**

```text
node --test qa/gates/test-source-inventory.test.js qa/gates/traceability.test.js qa/gates/postman-inventory.test.js qa/gates/postman-token-inventory.test.js qa/gates/postman-categories-inventory.test.js qa/gates/postman-transactions-inventory.test.js qa/gates/postman-api-inventory.test.js qa/gates/login-oracle-controls.test.js
node --test qa/verify/verify-ci.test.js
node scripts/test-source-inventory.js --check
node scripts/postman-api-inventory.js --check
node scripts/traceability.js
node scripts/check.js
node scripts/verify-ci.js --plan
```

Results: **68/68** inventory/traceability/Login pure controls and **13/13** CI orchestration controls passed; both generated inventories were current; F13 reported 280 IDs / 78 rule definitions; `scripts/check.js` passed 8/8. The plan reported `NOT_RUN` for every task, as intended. Pure controls use in-memory mutations or their own isolated temporary child fixtures; this batch did not start a product server, Newman, browser, database, load run or provider call.

## Boundary

Structural declaration accountability is complete for this reviewed source snapshot, **not** proof that all 280 expected behaviors executed or are semantically sufficient. The accepted API inventory retains its disclosed oracle limits. Separate AI source identities are not promoted to main catalogue cases or personal skill claims. Whole F19 stays **OPEN** pending independent review and other layers; the earlier 17/25 project tally is unchanged. No CI-green, UAT or release claim follows from local static checks.

## 2026-10-15 — ORD-108 discovery and config correction

The independent ORD-107 review reproduced two bypasses in the initial checker: `qa/e2e/new.spec.ts` and `new.spec.mjs` were not discovered, and `qa/e2e/reports/new.spec.js` was skipped because every directory named `reports` was ignored. Its isolated fixture found 0/3 paths. Before changing the scanner, the new pure witness failed on `new.spec.ts` as expected. In-progress review also identified the analogous `qa/e2e/__pycache__/new.spec.js` basename bypass. After the correction the fixture detects `.js`, `.ts`, `.mjs`, `.mts`, `.cjs`, `.cts`, `.jsx`, `.tsx`, the corresponding `.test.*` forms, Python `.py`, and nested `reports/` and `__pycache__/` browser specs. A discovered unknown test fails source validation until reviewed; no synthetic test was executed.

Only the canonical generated-output directory `qa/reports/` is excluded by that name; a nested source directory named `reports` is scanned. `node_modules` is excluded at any depth because the installed Playwright collector excludes it. `__pycache__` is scanned: Python's `.pyc` cache files do not match the supported source extensions, but a Playwright `.spec.js` placed there can be executable. Source symlinks are rejected, not followed. New test names in the supported source roots cannot be silently absorbed into the current reviewed manifest.

The manifest now has **six separate, byte-pinned execution-config records**: `package.json`, `package-lock.json`, `pytest.ini`, and the main, AI and accessibility root Playwright configs. They are not scenarios. The checker also detects new root `playwright[.label].config.(js|ts|mjs|mts|cjs|cts|jsx|tsx)` candidates; root and `qa/python/` or `qa/selenium/` `pytest.ini`, `pyproject.toml`, `tox.ini`, and `setup.cfg` candidates. Changed, missing, or new candidates fail the check until reviewed. The pinned package scripts bind the current runner commands; runner JS/Python sources remain in the source inventory. Configs are read as bytes but never imported or semantically interpreted. Arbitrary alternate config names, external CLI overrides, and dynamic execution not represented in these bounded paths remain outside this static guarantee.

The regenerated artifact records **137 source files + 6 configs** (143 file identities), **280 main catalogue IDs** with the same family counts, and **20 reviewed parameter identities**. The three discovery/config controls increased the inventory-focused pure batch from 68 to **71/71 PASS**; CI controls remain **13/13 PASS**. Both inventory `--check` commands, F13 static 280/78, `scripts/check.js` 8/8, and the shared `--plan` passed; all 22 plan tasks remain `NOT_RUN`. These are local static results, not CI, browser, HTTP, database, semantic coverage, UAT or release evidence. Whole F19 remains **OPEN**, and the prior 17/25 audit tally is unchanged pending independent targeted recheck.

## 2026-10-16 — local source-accountability acceptance

After the resumed ORD-108 checks, a targeted independent agent review accepted the repaired discovery and configuration boundary. Local coordination then accepted the original F19 **bidirectional source-accountability criterion** for the current reviewed `qa/` and `scripts/` roots: each of the **280** active main catalogue IDs has a source edge, and supported source scenarios are linked or explicitly classified. The artifact records **137 source files, six separate configuration identities and 20 reviewed parameter identities**. The resumed pure checks passed **71/71** inventory/traceability/Login and **13/13** CI-orchestration controls; both inventory `--check` commands passed. The shared plan marked all **22 tasks `NOT_RUN`**.

This is a local agent review at the **CHANGED** stage, not owner acceptance or a human audit. The F19 source criterion is locally repaired (project engineering findings **18/25 by count**, not effort or release progress). It does not mean 280 behavioral passes, complete semantic oracles, full combined-tree runtime execution, exact-SHA remote CI, owner UAT or release readiness. Arbitrary alternate config names, external CLI overrides and dynamic execution outside the supported paths are not guaranteed. The [QA status](../../docs/qa-status.md) keeps those release gates and open defects separate.
