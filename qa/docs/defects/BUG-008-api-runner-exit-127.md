# BUG-008 · The API runner exits 127 on a green run, so the first CI build would be red

![severity](https://img.shields.io/badge/severity-High-orange?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | High |
| **Priority** | P0 — it breaks the pipeline that gates everything else |
| **State** | CLOSED 2026-09-03 |
| **Found by** | checking the exit code of `npm run test:api` by hand |
| **Component** | `qa/api/run.js` — `cleanUp` |
| **Affects** | `.github/workflows/ci.yml`, job **api**, the step the e2e job depends on |
| **Environment** | Windows 11, Node v24.13.1, better-sqlite3 13.0.3 |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Summary

93 requests, 340 assertions, nothing failed — and the runner exits **127**.

CI reads that number and nothing else. The step `- run: npm run test:api` would
have failed, taking the e2e job with it, so **the first build after the first
push would have been red on a step that passed**.

Found before the push rather than after, which is the only reason it is worth
less than it could have been.

## Steps to reproduce

```
npm run test:api ; echo $?
```

Also reproduced as `node qa/api/run.js` directly, so npm is not mangling
anything on the way out.

## Expected

0. The exit code is the result, or the command cannot gate anything.

## Actual

127, consistently, on a fully green run.

## Why this is High and BUG-006 is Low

Same symptom, different blast radius. [BUG-006](BUG-006-load-runner-exit-127.md)
was in the load runner, which nothing depends on — it was an annoyance. This one
is wired into CI, and a red first build on a repository somebody is reading as a
work sample costs more than a wrong number normally does.

## Root cause — isolated, not inferred

BUG-006 blamed `child.kill()`. **That was wrong**, and this is where it was shown
to be wrong. Six standalone reductions, each one script — five in the table, the sixth below:

| # | What it did | Exit |
|---|---|---|
| 1 | spawn a server, kill it, return normally | **0** |
| 2 | spawn, kill, then `rmSync` the database | **127** |
| 3 | same as 2, with synchronous logging | **127** — dies *inside* `rmSync` |
| 4 | spawn, **no kill**, `rmSync` the live server's database | **127** |
| 5 | spawn, kill, **wait for the `exit` event**, then `rmSync` | **0** |

Test 1 clears the kill. Test 4 convicts the delete on its own — no kill is
needed to reproduce it at all.

<details>
<summary>Test 3, the one that shows where the process dies</summary>

```
about to kill
killed, killed flag = true
  rmSync killtest3.db
OBSERVED EXIT CODE: 127
```

The script writes with `fs.writeSync(1, …)`, so nothing can be lost to a
truncated stdout. `    ok` and `    threw <code>` are both absent: `fs.rmSync`
neither returned nor threw. The process was terminated inside the call.

</details>

<details>
<summary>Test 6 — is it SQLite, or any open file?</summary>

```
rmSync a PLAIN file another process holds open
  ok — deleted
survived
EXIT (plain open file): 0
```

A plain file held open by another process deletes cleanly and the caller
survives. So the trigger is specific to a database `better-sqlite3` still has
open, not to open files in general.

</details>

**So the mechanism is:** `fs.rmSync` on a `better-sqlite3` database another
process still has open terminates the calling process, with no exception and no
return. Killing the child first does not help, because the kill is asynchronous
and the file is still held a moment later — which is exactly the shape
`cleanUp` had.

**What is still not identified:** *why* the process is terminated rather than
receiving `EBUSY`. Stated rather than guessed. The trigger is pinned to one
line, which is what a fix needs; the rest would be a story.

## What this corrects in BUG-006

BUG-006's fix — stop killing, sweep at the start of the next run — worked,
because it removed the delete. It got the credit for removing the kill. A fix
that is right for the wrong reason leaves a false rule behind ("do not kill
children"), and a false rule eventually gets dropped as superstition, taking the
real protection with it.

The load runner needs no code change. Ports 3100–3102 were re-confirmed free
after a full load run.

## Fix

- **The run's own database is never deleted.** Old `data/api-*.db` files are
  swept at the **start** of a run, where they cannot affect a result that has
  not happened yet.
- **The server is killed and awaited** — `server.once('exit', …)` before
  returning.

Three things have to be true at once, and only that ordering gets all three:

| Requirement | What breaks it |
|---|---|
| the child must die | no kill at all → an orphan holds port 3001 after every run |
| the process must end by itself | a live child keeps the event loop referenced → a version without the kill **hung for five minutes** |
| the exit code must survive | `process.exit()` truncates buffered stdout → the entire summary and the 963 KB HTML report vanished when it was tried |

The third is worth keeping in mind: `process.exit()` is the obvious way to end a
process that will not end, and it silently discards output that has been written
but not yet flushed to a pipe.

## Regression

```
npm run test:api           requests 93 (0 failed), assertions 340 (0 failed)
exit code                  0
qa/reports/api-report.html 963 KB, written
port 3001 afterwards       no LISTENING socket
data/api-*.db              swept at the start of the next run
```

## → Rule R8 (rewritten)

Do not delete a database another process still has open — on this platform it
kills the deleting process rather than returning an error. More generally:
cleanup must not be able to change the result. Do it at the start of the next
run.
