# BUG-005 · One end-to-end test times out on runs that are ~3× slower than normal

[← Back to README](../../../README.md#qa-evidence) · [Next: browser suite →](../../../qa/e2e/)

![severity](https://img.shields.io/badge/severity-Low-lightgrey?style=flat-square)
![state](https://img.shields.io/badge/state-OPEN-red?style=flat-square)

| | |
|---|---|
| **Severity** | Low |
| **Priority** | P3 — intermittent, and no user-facing symptom is known |
| **State** | OPEN — deliberately, see below |
| **Found by** | the end-to-end suite itself, twice: S08 and S10 |
| **Component** | unknown — that is the point of this entry |
| **Affects** | `qa/e2e/schedules.spec.js › the 31st is accepted and explains itself` |
| **Environment** | Chromium, four Playwright workers, local server |
| **Fixed in** | Not fixed. The cause was never characterised; see below. |
## Summary

The suite normally finishes in about 11 seconds. Twice it has taken 36–39
seconds, and on both of those runs the same single test failed with a test-level
timeout.

**This is not characterised, and it is open rather than closed as "flaky".**
"Flaky" is a word that ends an investigation without finishing one.

## What happens

```
Error: locator.fill: Test timeout of 30000ms exceeded.
qa/e2e/schedules.spec.js › Schedules › the 31st is accepted and explains itself
```

The 30 000 ms is the **test** budget, not the action's own timeout — so the test
spent its entire allowance before a `fill` could act.

## The signature, from two occurrences

Both share it: the same test, and a whole-suite runtime roughly three times
normal. At two data points that is no longer coincidence, which is why it is
written down rather than shrugged at.

**Why that test and not another:** it has the longest chain of sequential UI
actions in the suite — navigate, fill, assert, fill, assert, fill, fill, fill,
click, assert. If everything is slower, it is the first to exhaust a fixed
budget. That makes it the *symptom*, not necessarily the fault.

## What was tried, and did not reproduce it

| Attempt | Result |
|---|---|
| The test alone, repeatedly | passes, ~0.5 s |
| Full suite, four consecutive runs | 64/64, 10.6–11.4 s |
| Full suite twice from a cold database | 64/64, ~11 s |
| Full suite **while the k6 load smoke saturated a core** | 64/64, 11.4 s |

The last row is the interesting one: the experiment designed to provoke it did
not.

## Leading suspicion, unconfirmed

Every end-to-end test registers its own user, and at the time registration ran
`bcrypt.hashSync` — about 55 ms of blocked event loop each, measured in S07.
Four parallel workers on a loaded machine could queue the server enough to stall
a page mid-render.

That was the residual of [BUG-004](BUG-004-bcrypt-blocks-event-loop.md), and it
has since been fixed — registration is asynchronous now. **If the suspicion was
right, this defect is already gone**, and the way to find out is time: a third
occurrence disproves it outright. Recording the prediction is what makes the
next run informative either way.

Named as a suspicion, not a cause. The load experiment above should have
provoked it and did not.

## What was NOT done, and why

The `expect` and test timeouts were **not raised**.

That would make the symptom disappear without anyone learning anything, and
this project's own exit criterion 6 (`qa/docs/test-plan.md`) forbids exactly
that: a test may start passing because the application changed, not because the
assertion was relaxed. Raising a timeout to close a bug is the clearest example
of the thing that criterion exists to prevent.

## S15 — CI now has a baseline, and it is not a slow run

The first green CI run took **38.3 s** for the 92 tests that take 13.9 s here,
which is 2.8× and looks exactly like this defect's signature. It was tempting to
write it down as one.

Two more runs settled it:

| Run | Duration |
|---|---|
| 1 | 38.3 s |
| 2 | 36.7 s |
| 3 | 36.6 s |

A 1.7 s spread across three runs is a **baseline**, not a slow run. CI is simply
a slower machine than the one this is developed on — four shared vCPUs against a
desktop — and 37 s is its normal.

**The signature was always relative to a machine's own normal**, and reading
"2.8× slower than local" as if it were "2.8× slower than usual" was a mistake
made and corrected inside one session. Two numbers being three times apart does
not make them the same observation.

What is genuinely gained: CI now *has* a baseline. A run there at 110 s would be
the signature, and unlike this machine, CI keeps every run's timing where it can
be looked at afterwards.

**Still open.** Nothing has recurred, and the bcrypt suspicion above is still
neither confirmed nor ruled out.

## Next step when it recurs

Capture the failing run with `--trace on` and `PWDEBUG` timing, and log the
server's own request timings alongside, so the queue can be seen rather than
guessed at. A third occurrence turns the suspicion above into something
testable.

## → No rule yet

A rule drawn from an uncharacterised failure would be a guess with a number on
it.
