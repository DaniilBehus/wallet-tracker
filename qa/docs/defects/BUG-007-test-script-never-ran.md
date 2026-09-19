# BUG-007 · A test script never ran, and the suite reported it as green

![severity](https://img.shields.io/badge/severity-Medium-yellow?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | Medium |
| **Priority** | P1 — false confidence, in the layer whose whole job is confidence |
| **State** | CLOSED 2026-09-03 |
| **Found by** | the API suite, run as a routine check after an unrelated change |
| **Component** | `qa/api/wallet.postman_collection.json` — `08 · Settings and the month balance / Another user's income does not leak` |
| **Affects** | the reported assertion count, and one cross-user isolation check |
| **Environment** | newman 6.2.2, Node v24.13.1 |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Summary

One request in the collection asserted **nothing**, for as long as it had
existed, and the suite reported the run as green.

The request checks that user B cannot see user A's income — cross-user
isolation, spec §4.3, one of the properties this API is most obliged to hold.

## What the run said

```
requests   93  (0 failed)
assertions 337  (0 failed)
```

Green, and quoted as green in two earlier session logs.

Underneath, newman's own table said `test-scripts 93 1`:

<details>
<summary>The failure newman did report, and nobody read</summary>

```
  #   failure       detail

 1.   SyntaxError
                    missing ) after argument list
                    at test-script
                    inside "08 · Settings and the month balance / Another user's income does not leak"
```

</details>

Three assertions were missing from `337` — the 200, the schema, and the
property itself — with nothing to indicate that anything was absent.

## Root cause

An apostrophe.

```js
pm.test('user B has their own income, not user A's', function () {
```

The string is single-quoted and the name contains `user A's`, which closes it
early. Everything after that is a syntax error, so the script never parses and
never runs.

The collection contains its own counter-example: the neighbouring test at line
875 is written `pm.test("user B's categories are not user A's rows", …)`. Same
author, same file, one got it right.

## Why nothing caught it

Three mechanisms each came within touching distance, and the way they failed is
the same:

| | Why it did not catch it |
|---|---|
| **The summary line** | a script that throws before its first `pm.test` contributes zero assertions **and** zero failures. Absence is indistinguishable from success |
| **The exit code** | 127 — but that was happening on green runs too ([BUG-008](BUG-008-api-runner-exit-127.md)), so the number carried no signal |
| **Gate C8** | counts statuses asserted by matching `expectStatus(…)` in the script *text*. A script that never executes still matches. C8 reads the source, not the run |

Every one of those reports on the run without being able to distinguish
"checked and passed" from "did not check".

## Fix

Two parts, and the second is the one that matters.

**1. The test name moved to double quotes**, matching its sibling.

**2. `qa/api/run.js` prints the script count on every run:**

```
requests   93  (0 failed)
assertions 340  (0 failed)
scripts    93  (0 failed to run)
```

and, when it is non-zero, says what that means in words:

```
  1 test script(s) did not execute. Their assertions are
  missing from the count above, not passing.
```

Printed **always**, not only when something is wrong. A number that appears only
on bad days is a number nobody has learned to read — and the point of showing
`93/93` next to `340` is that the two only mean something together.

## Regression

The three missing assertions came back: **337 → 340**, and the cross-user income
check now runs. It passes, which is worth saying plainly — the application was
never wrong. What was wrong was the claim that it had been checked.

## → Rule R10

A test that does not run reports the same as a test that passes. Count what
executed, not just what failed — and print the count on green runs too.
