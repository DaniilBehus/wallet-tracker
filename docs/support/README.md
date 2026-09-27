# Support pack

[← README](../../README.md) · [Runbook](runbook.md) · [SQL diagnostics](sql-diagnostics.md) · [Log exercise](log-exercise.md)

How to support Wallet once it runs: start it, read its log, check its data, and
work an incident from what a person reports to its cause. It is written for
application support — the person who hears "it doesn't work" and has the logs,
the database and the code, but not the person's screen.

## What it is, and what it is not

**It is** a working set for this app. Every command in it was run on Wallet,
every log line and query result was copied from a real local run, the SQL is
run by the test suite straight off its page, and the exercise's quotes are
checked against its log.

**It is not** a record of production support. Wallet is a personal project: no
users besides its owner, no production deployment, no on-call rota and no
service levels. The incidents are reconstructed from real defects that tests
found, reproduced locally on the code as it was before each fix; nobody
reported them. There is no monitoring either: the log is a file on the machine
that runs the app.

## What is in it

1. **Request id and request log.** Every response carries an `X-Request-Id`;
   when the app shows an error, the id's first eight characters appear under it
   as **Reference**. The server writes one JSON line per request and, for an
   error it did not expect, an `UNHANDLED` line with the same id and the stack.
   What the lines hold, and what they never hold:
   [runbook §2](runbook.md#2-where-the-logs-go). Code:
   [`src/requestlog.js`](../../src/requestlog.js). Tests:
   [`qa/python/test_request_log.py`](../../qa/python/test_request_log.py).
2. **[Runbook](runbook.md).** Start and stop, where the logs go, one request by
   its reference, the health check, and triage for five kinds of report — cannot
   sign in, a save refused, AI unavailable, a limit figure that looks wrong, a
   scheduled payment missing — with an escalation template.
3. **[SQL diagnostics](sql-diagnostics.md).** Read-only queries for a person's
   user id, month total, limit state, scheduled payments, keyed saves and AI
   quota, each with its parameters and result columns.
4. **Incidents.** Tickets in ITSM form for three real defects, with the lines
   from their reproductions:

   | Ticket | What a person would meet | Priority | Problem |
   |---|---|---|---|
   | [INC-001](incidents/INC-001.md) | Editing a loan fails while it is being paid elsewhere | P3 | BUG-012 |
   | [INC-002](incidents/INC-002.md) | The whole app stalls while somebody keeps sending wrong passwords | P1 | BUG-004 |
   | [INC-003](incidents/INC-003.md) | Creating an account reports an error, but the account exists | P3 | BUG-016 |

5. **[Log-reading exercise](log-exercise.md).** Three questions about
   [the log of a real run](exercise.log) with one planted failure, and a worked
   answer folded away.

## Incident, problem, change

- **Incident:** something is not working for someone now. The goal is to restore the service, and a workaround counts.
- **Problem:** the cause behind one or more incidents. The goal is to find and remove it; in Wallet, a problem is a defect in [the register](../../log/BUGS.md).
- **Change:** the controlled fix that removes it. In Wallet, a commit that carries the fix and the test that proves it.

## Priority

Priority is impact × urgency:

| Impact ↓ · Urgency → | High | Medium | Low |
|---|---|---|---|
| **High** | P1 | P2 | P3 |
| **Medium** | P2 | P3 | P4 |
| **Low** | P3 | P4 | P4 |

- **Impact** is what is lost, and by how many. *High:* everyone is affected, or
  money or data is wrong or lost. *Medium:* one person or one feature stops
  working, and no data is lost. *Low:* nothing stops working, such as a wrong
  label.
- **Urgency** is how soon it hurts more. *High:* there is no workaround, and it
  lasts. *Medium:* a workaround works now, such as trying again. *Low:* it can
  wait for the next ordinary fix.

INC-002 is P1: every request from every person waited, with nothing they could
do. INC-001 and INC-003 are P3: one feature failed for some people, trying again
or signing in worked, and nothing was lost.

This scale measures what a person loses. The defect register's priority
measures the broken promise, so one defect can carry both: BUG-012 is P1 in the
register and its incident, INC-001, is P3 here.
