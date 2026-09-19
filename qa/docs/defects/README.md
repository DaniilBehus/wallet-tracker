# Defects found by the test layer

Reports for defects **found by `qa/`** — the API collection, the end-to-end
suite, the load smoke, the concurrency layer, or the CI gates. One file per
defect, named after its id.

**Not every entry in the register has a file here, and that is deliberate.** A
file is written when the reasoning is longer than the register entry can carry —
an isolation, a before/after measurement, a correction to an earlier report. The
register in `log/BUGS.md` is complete; this folder is where the long ones live.

`log/BUGS.md` in the repository root remains the single register for the whole
project, and every defect appears there whether the test layer found it or a
person did. These files are the longer write-up: the reasoning, the evidence,
and what the test that caught it now guarantees.

| ID | Title | Severity | Found by | State |
|---|---|---|---|---|
| [BUG-003](BUG-003-pay-button-stuck.md) | The pay button stays on its busy label after a refused payment | ![](https://img.shields.io/badge/Medium-yellow?style=flat-square) | TC-E2E-030 | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [BUG-004](BUG-004-bcrypt-blocks-event-loop.md) | Twenty wrong passwords a second make the app unusable for everyone | ![](https://img.shields.io/badge/High-orange?style=flat-square) | TC-LOAD-002 | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [BUG-005](BUG-005-e2e-timeout-on-slow-runs.md) | One end-to-end test times out on runs that are ~3× slower than normal | ![](https://img.shields.io/badge/Low-lightgrey?style=flat-square) | the e2e suite | ![](https://img.shields.io/badge/OPEN-red?style=flat-square) |
| [BUG-006](BUG-006-load-runner-exit-127.md) | The load runner returned 127 after a run where every threshold passed | ![](https://img.shields.io/badge/Low-lightgrey?style=flat-square) | the load layer | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [BUG-007](BUG-007-test-script-never-ran.md) | A test script never ran, and the suite reported it as green | ![](https://img.shields.io/badge/Medium-yellow?style=flat-square) | the API suite | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [BUG-008](BUG-008-api-runner-exit-127.md) | The API runner exits 127 on a green run, so the first CI build would be red | ![](https://img.shields.io/badge/High-orange?style=flat-square) | checking the exit code | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [BUG-009](BUG-009-segfault-on-node-20.md) | The server segfaults on Node 20 in CI, so the first build was red | ![](https://img.shields.io/badge/High-orange?style=flat-square) | the first CI run | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [BUG-010](BUG-010-runner-green-on-no-server.md) | The API runner exits 0 when the server never starts, so CI called it green | ![](https://img.shields.io/badge/Critical-critical?style=flat-square) | reading the CI logs | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [BUG-012](BUG-012-deferred-transaction-500.md) | Two processes writing one database answer 500 | ![](https://img.shields.io/badge/High-orange?style=flat-square) | the race layer | ![](https://img.shields.io/badge/CLOSED-brightgreen?style=flat-square) |
| [LIMIT-001](LIMIT-001-serialised-database-work.md) | Every request queues behind database work — 23× slower under write load | ![](https://img.shields.io/badge/type%3Alimit-blueviolet?style=flat-square) | TC-LOAD-001 | ![](https://img.shields.io/badge/ACCEPTED-blue?style=flat-square) |

**Two defects are not here, deliberately.** BUG-001 and BUG-002 were found
during the build of the frontend, before this layer existed — they are in
`log/BUGS.md` where they belong. BUG-002 now has a permanent regression case
here as TC-E2E-024, which is the part that matters.

The API layer — 116 requests, 431 assertions, every boundary in spec §4.3, all
five token states, every cross-user path — has found no defect **in the
application's request handling**. It found four in itself and in the pipeline
around it (BUG-007, BUG-008, BUG-009, BUG-010), which is a different and less
comfortable result, recorded rather than padded out: a register with invented
entries is worth less than an empty one, and one that quietly omits the tester's
own mistakes is worth less than both.

Three of those four are the same shape — **the machinery reporting a result it
had not actually obtained**. That is the failure mode of a test layer, the way
wrong arithmetic is the failure mode of an accounting app, and it is worth
knowing that this project's own defects cluster there.

**The concurrency layer (`qa/race/`) broke the pattern on its first run.** It
found two defects in the application itself — BUG-011 and BUG-012 — and neither
was reachable from any layer that existed before it: both need two server
processes on one database file, which nothing had ever done. A whole class of
defect was invisible not because the tests were weak but because the *condition*
had never been created. That is the argument for the layer, and it made it
before the layer had finished being written.

It also produced two honest non-findings, which are recorded with the same
weight: nothing was wrong within a single process (40 of 40 pairs clean), and
free-text fields do not execute (`qa/e2e/security.spec.js`, 10 of 10). An empty
result is a result.

---

## Badge colours, fixed

Badges are decoration only if they mean different things in different files.
These are the values, and nothing else is used:

| Badge | Value | Colour |
|---|---|---|
| `severity` | Critical | `critical` |
| `severity` | High | `orange` |
| `severity` | Medium | `yellow` |
| `severity` | Low | `lightgrey` |
| `state` | OPEN | `red` |
| `state` | CLOSED | `brightgreen` |
| `state` | ACCEPTED | `blue` |
| `type` | limit | `blueviolet` |

Every badge carries `?style=flat-square`. A `LIMIT-###` entry has a `type` badge
instead of a `severity` one, because it has no severity — it is not a defect.

## What is collapsed and what is not

Long measurement blocks — before/after tables, raw k6 output, bisection logs —
live inside `<details>`. **Root cause and Fix are never collapsed**, because
they are what a reader opens the file for. Evidence supports the claim; it
should not be the first thing between the reader and it.
