# BUG-006 · The load runner returned 127 after a run where every threshold passed

[← Back to README](../../../README.md#qa-evidence) · [Next: load runner →](../../../qa/load/run.js)

![severity](https://img.shields.io/badge/severity-Low-lightgrey?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | Low |
| **Priority** | P2 — no user-facing effect, but the command cannot be used as a gate |
| **State** | CLOSED 2026-09-03 |
| **Found by** | the load layer itself, S12, while adding the third script |
| **Component** | `qa/load/run.js` |
| **Affects** | `npm run test:load`, and any CI step that would depend on its exit code |
| **Environment** | Node v24.13.1, Windows 11, k6 spawned as a child process |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Summary

Every k6 process exits 0, every threshold passes, the summary prints — and the
runner exits **127**.

A green run reporting failure is worse than a red one reporting failure: the
number is the only thing an automated caller reads, and here it disagreed with
everything the run had just measured.

## Steps to reproduce

1. `npm run test:load`
2. Read the exit code: `echo $?` (PowerShell: `$LASTEXITCODE`).

## Expected

The exit code is the result. A green run must report success, or the command
cannot be a gate at all.

## Actual

127, consistently. Earlier in the same investigation the runner also died
*silently* between scripts, so the second and third measurements never ran and
nothing was printed about why.

## Root cause — two, in the same few lines

**1. An error handler written for one situation, firing in another.**

`startServer` attached `server.on('error', …)` that called `process.exit(1)`.
That handler was written for "the server would not start" — but it also fires
when the child is killed **on purpose**. Cleaning up after the first script
therefore ended the whole run, with the message buried in k6's output, so it
read as "it just stopped".

**2. The kill itself.**

With that fixed, the exit code stayed wrong. Bisected by removing one thing at
a time:

<details>
<summary>What was tried, in order</summary>

| Attempt | Exit code |
|---|---|
| Guard `child.kill()` with a benign `error` listener | still 127 |
| Wrap `child.kill()` in `try`/`catch` | still 127 |
| Move the kill into a `process.on('exit')` handler | still 127 |
| **Remove the kill entirely** | **0**, instantly and repeatably |

</details>

Calling `child.kill()` at all was enough to corrupt the runner's own exit status
on this machine.

**The mechanism behind the second one is not identified.** Saying so is more
useful than a guess with a number on it — a plausible-sounding cause written
into a defect report is indistinguishable, later, from one that was verified.

## Fix

The runner no longer kills anything. The servers are its children and die with
it — confirmed by checking ports 3100–3102 afterwards, all free.

The only remaining housekeeping is deleting old `data/load-*.db` files, and that
moved to the **start** of a run, where it cannot affect a result that has not
happened yet. Cleanup that runs after a measurement is cleanup that can damage
one.

k6 is also spawned directly rather than through `shell: true`, which removes
Node's own deprecation warning about unescaped arguments.

## Regression

```
runner -> 0
scripts run: 3
summaries: qa/reports/load-*.json
ports 3100, 3101, 3102 free afterwards
```

## → Rule R8

A process that reports a result must not also do cleanup that can change its
exit status. Do the cleanup at the start of the next run instead.
