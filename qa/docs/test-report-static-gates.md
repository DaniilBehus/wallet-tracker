**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-static-gates.md)

# Static gate exceptions and evidence boundaries — local report

[← Back to README](../../README.md#qa-evidence) · [Run commands](../../docs/testing.md) · [Negative controls](../gates/validator-controls.test.js) · [Next: observed API matrix →](test-report-contract.md#observed-status-matrix)

Recorded 2026-10-10 against `b270355c8c850282b10cc0a7bdeb81c88b784765` plus local, uncommitted changes. This report describes local checks, not a published commit or a new GitHub CI run. No production endpoint or test expectation was weakened in this slice.

## Findings and repair

| Finding | Before | Local change |
|---|---|---|
| [BUG-030](../../log/BUGS.md) (F15) | C9 checked only reason length. A well-formed exception for a nonexistent route, testid or status could pass C9; a redundant or duplicate entry could remain. Malformed entries could throw instead of yielding a gate verdict. | C9 now compares each exception with the **same current inventory** C6–C8 use. It rejects absent, already-addressed, duplicate and invalid entries, and requires a usable reason. A missing inventory fails closed without inventing a stale finding. |
| [BUG-031](../../log/BUGS.md) (F14) | Gate wording could be read as proof that requests, page-object locators or status branches executed. | C6–C8 are labelled static declaration comparisons. C9 validates exception identity and reason only. Documentation points to real-response evidence separately. |

The negative controls run the actual check modules through an in-memory file seam; they do not rename or delete project inputs. On the old logic, the initial control run had **23 passed and 6 failed**: the six new stale/redundant/invalid-shape checks did not get their required C9 verdict (one malformed shape threw). After the repair, the expanded suite also checks unavailable inventories and restoration of original input hashes. The final source passed **31/31 controls** in a separate independent local execution. The real exceptions file still has one C8 entry, `500`; C9 accepts it because `500` is currently declared by source but has no matching assertion declaration.

## What these gates do and do not establish

- **C6:** 21 route declarations are compared with collection request declarations. Parameter spelling is normalized for the comparison. A matching request declaration does not prove its runtime execution.
- **C7:** 117 literal/generated-prefix testid declarations are compared with page-object text/address patterns. This is addressability, not a rendered-screen or selector-uniqueness measurement.
- **C8:** 14 source status literals are compared globally with 14 assertion literals in the collection and AI tests. A matching code somewhere is **not** proof that every operation returning that code was exercised.
- **C9:** exceptions must refer to a currently unaddressed item in those same static inventories, carry a usable reason, and be unique. It does not establish runtime behavior.

The [contract report's observed operation/status matrix](test-report-contract.md#observed-status-matrix) is the stronger, separate real-HTTP layer and explicitly marks **NOT EXERCISED** cells. Even that matrix covers only its captured cases. The `500` exception records an **unexercised global static gap**: expected-input tests reject unexpected 500 responses, but that is not an exercised controlled internal-error response. Such a test is possible future work; the exception does not claim otherwise or imply broad 500 coverage.

## Verification and limits

The worker's first final sequence passed `test:gates` **31/31**, `check` **8/8** (zero skips), `check:openapi` **21/21 source operations** and `test:dates` **4/4**, but its disposable contract server did not start before timeout and the offline evaluator could not write its report pair. Those two worker commands **failed**. Their exact environmental causes were not established.

After the last invalid-entry control was added, an independent local execution of the unchanged final source passed `test:gates` **31/31** (including `null`/array entries), `check` **8/8** (zero skips), `test:contract` **15/15 with 340 validated real HTTP responses and 21 operations**, and `eval:ai` **116/116 fixture checks, NOT_MEASURED**; those commands exited 0. This later evidence does not retroactively turn the worker failures into passes or diagnose them. OpenAPI and date counts above are the worker's prior successful runs, not claimed as independent reruns.

The scanners intentionally recognize focused literal source forms rather than arbitrary dynamic JavaScript. C8 is global rather than per-operation. Historical gate counts and dated reports remain as originally recorded. Publication, combined-tree CI and independent review are separate gates still pending for these local changes.
