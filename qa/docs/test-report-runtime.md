# Runtime compatibility — focused local report

[← Back to README](../../README.md#qa-evidence) · [Next: running the tests →](../../docs/testing.md)

## Requirement and risk

The installed `better-sqlite3` binding requires Node-API 10. The former
`>=22` engine admitted Node 22.9 with Node-API 9. CI's floating `22` selector
normally chooses the latest patch in that line, so it did not exercise the
claimed minimum; it is not evidence that CI actually selected Node 22.9.
The native crash observed on that runtime is consistent with the API mismatch;
its precise native instruction-level cause was not isolated. Do not repeat that
native crash as a regression test.

The package and lock root now specify stable Node
`^22.14.0 || >=23.6.0`. CI pins exact 22.14.0 as a compatibility-floor
baseline. This pin is not a security recommendation; ordinary use should favor
a current patched supported LTS. A future version satisfying the range is not
automatically certified by this focused test.

## Focused checks

The first four new controls failed before the fix: old package engine,
missing guard, old CI floor and native import attempted before rejection.
The controls cover stable 22.13/22.14 and 23.5/23.6 boundaries, newer majors,
Node-API 9/10, missing or invalid API, malformed and prerelease versions.
The initial controls also mutated a copy of the workflow to reject a wrong
floor or wrong `node-version` value, including CRLF parsing. A later focused
review found that global field counts could still accept a field moved to an
unrelated action; see the correction below. A disposable child simulates an
unsupported runtime and records that `src/db.js` rejects it before loading
`better-sqlite3` or creating a data directory.

On the exact portable Node 22.14.0 executable with Node-API 10, the initial focused
runtime/verification/E2E-runner set finished **30 pass, 1 optional Windows
symlink fixture skip, 0 fail** (31 total). The static check finished **8 pass,
0 skip, 0 fail**. One guarded existing HTTP contract rerun finished **15 pass,
0 fail**, with 340 validated real loopback responses across 21/21 declared
operations. These are local results after the guard change; neither an earlier
green CI run nor simulated values alone are treated as current full-suite
evidence.

## Follow-up: setup-node input binding, 2026-10-12

A review found one false-positive control, not a defect in the actual workflow:
the old helper counted six `setup-node` steps and six `node-version` fields
globally. Moving the API step's version field into an `upload-artifact` `with`
mapping kept those counts equal, so the malformed in-memory workflow passed.
The new regression first failed with **“Missing expected exception”** on that
exact moved-input witness. An earlier attempt had a fixture-shape typo for the
upload step; that harness error was corrected before this expected failure and
was not a product failure.

The helper now checks each literal `setup-node@v4` step's **own** `with` mapping
for exactly one `${{ env.NODE_VERSION }}` input. It rejects missing, duplicate,
wrong or relocated values, duplicate/ambiguous `with`, job/step floor shadows,
unsupported nested shapes and unknown `setup-node` action versions. A new
`@v5` fixture first failed with **“Missing expected exception”** because the
helper only scanned `@v4` mentions; scanning all `setup-node@` references now
rejects that unsupported form instead of silently omitting it. The current
workflow passes in LF and canonical
CRLF; the moved-input and other negative fixture variants are rejected in
both representations. This is a bounded parser for this workflow's literal
step form, not a general YAML parser or proof of GitHub action execution.

The exact Node 22.14.0 / Node-API 10 follow-up run of runtime,
verification and E2E-runner controls finished **32 pass, 1 optional Windows
symlink fixture skip, 0 fail** (33 total). `scripts/check.js` again finished
**8 pass, 0 skip, 0 fail**. No HTTP contract, full CI group or remote workflow
was rerun for this test-only correction. BUG-034 remains IN PROGRESS and local,
pending publication and remote CI evidence.

Subsequently, the coordinator reported an independent combined control run of
**31 pass, 1 fail, 1 skip**: the actual Wallet-server readiness control hit its
five-second timeout. One focused retry passed in about 365 ms; the timeout's
cause remains unproven, and that retry is not a latest combined green run.
After the narrow CRLF-fixture and unsupported-action-version corrections here,
only the six runtime controls were rerun: **6 pass, 0 fail, 0 skip**. The
earlier 32-pass combined result remains historical, not a claim about this
latest tree.

## Limits

The version-boundary and import-order probes are synthetic. They establish
guard behavior, not native binary compatibility across all future versions.
The actual Node 22.9 executable was not run against the new guard; its earlier
native crash was deliberately not repeated.
No full CI group, browser suite, AI provider, dependency reinstall, or remote
GitHub Actions run is claimed by this focused work.
