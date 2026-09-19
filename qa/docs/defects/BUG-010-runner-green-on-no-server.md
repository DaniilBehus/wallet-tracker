# BUG-010 · The API runner exits 0 when the server never starts, so CI called it green

![severity](https://img.shields.io/badge/severity-Critical-critical?style=flat-square)
![state](https://img.shields.io/badge/state-CLOSED-brightgreen?style=flat-square)

| | |
|---|---|
| **Severity** | Critical |
| **Priority** | P0 — the gate reports success without having checked anything |
| **State** | CLOSED 2026-09-05 |
| **Found by** | reading the CI logs of the run that [BUG-009](BUG-009-segfault-on-node-20.md) made red |
| **Component** | `qa/api/run.js` — `main` |
| **Affects** | the CI gate on the entire API layer |
| **Environment** | ubuntu-latest, Node 20; reproduced locally on Windows, Node 24 |
| **Fixed in** | Fixed. The original commit is not part of this public snapshot. |
## Why this one is Critical

Every other entry in this register is something that broke. This is something
that **passed when it should have broken**, which is the only failure mode a
test layer has that costs more than having no test layer at all: it converts
"we do not know" into "we checked".

The severity scale in `log/BUGS.md` is written about the product — data loss or
wrong money. This is not that. It is graded Critical on the register's other
axis, deliberately and with the reasoning here rather than hidden in a column:
the API gate reported success on a run where **zero requests were sent**.

## What CI said

```
the server at http://localhost:3001 never became healthy (fetch failed)
✓ API checks (newman) in 55s
```

The failure is printed, in full, immediately above a tick. The only other trace
was one step later:

```
##[warning]No files were found with the provided path: qa/reports/.
```

Nothing was uploaded because nothing was produced, because nothing ran.

## Steps to reproduce

```bash
node -e "require('http').createServer((q,s)=>{s.writeHead(500);s.end()}).listen(3060)" &
QA_PORT=3060 node qa/api/run.js ; echo $?
```

The blocker holds the port, so the server under test dies of `EADDRINUSE`; it
answers 500, so the health check keeps failing until it times out.

## Root cause

The exit code was assigned **after** an `await` that could never resolve.

```js
if (server && !server.killed) {          // the child is dead; killed is false
  await new Promise((resolve) => {
    server.once('exit', resolve);        // 'exit' already fired — never again
    server.kill();                       // returns false, emits nothing
  });
}
process.exitCode = code;                 // never reached
```

`server.killed` answers *"was a signal sent"*, not *"is the child gone"*. For a
child that died on its own it is `false`, so the branch was taken. The `exit`
event had already fired, so the promise never settled. `main()` never returned.
And with no handles left keeping the loop alive, Node exited **0**.

**Three things had to line up, which is why it survived:**

1. the server had to die *by itself* — a kill would have produced the event;
2. the failure had to be inside the `try`, so `code` was already `1` and the
   code path looked handled;
3. nothing else could be keeping the process alive, so it exited quietly
   instead of hanging — a hang would have been noticed within a minute.

## This is BUG-008 again, inverted

| | [BUG-008](BUG-008-api-runner-exit-127.md) | BUG-010 |
|---|---|---|
| What cleanup did to the result | turned a pass into 127 | turned a failure into 0 |
| Which direction it lies in | pessimistic — annoying | optimistic — dangerous |
| Rule broken | R8 | R8 |

Same rule, broken from both sides, in the same function, three sessions apart.
R8 already said *record the result before cleaning up*; the BUG-008 fix still
left the assignment at the bottom of `main()`. **A rule stated but not
structurally enforced is a rule you will break again**, and this is the evidence
for that in this project rather than in general.

## Fix

- `process.exitCode = code` moved **above** all cleanup, with a comment saying
  that nothing below it may change the result.
- The child's death is tracked from the moment it is spawned —
  `server.once('exit', () => { serverGone = true; })` — instead of asking
  `server.killed`, which answers a different question.
- A 5-second `unref`'d timeout on the wait, so a child that ignores SIGTERM
  costs a stray process rather than the whole run. The exit code is already set
  by then, so giving up is safe.

## Regression

The exact CI shape, reproduced locally:

```
the server at http://localhost:3060 never became healthy (HTTP 500)
EXIT: 1
```

And the ordinary green path still reports itself correctly:

```
requests   93  (0 failed)
assertions 340  (0 failed)
scripts    93  (0 failed to run)
exit 0
```

## → Rule R8

Unchanged in wording. Broken twice in implementation, which is the more useful
fact about it: record the result before cleanup, and treat "nothing below this
line may change the exit code" as a structural rule, not an intention.
