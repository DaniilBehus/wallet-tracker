**English** · [Slovenčina](../../locales/sk/qa/docs/test-report-e2e-isolation.md)

# Main Playwright E2E database isolation — local verification

[← Back to test setup](../../docs/testing.md) · [Next: test plan →](test-plan.md)

## Scope and original gap

The previous main Playwright configuration always passed `data/e2e.db` to its
server and did not honor a caller's `DB_PATH`. It therefore reused one file
across invocations. This is an isolation/design defect; no historical 429,
database-growth rate, or user-data loss is inferred from it. Within one run,
separate test users still share the same disposable server, SQLite file and
IP-based login limiter.

## Local change

`qa/e2e-runner/run.js` is outside Playwright's `qa/e2e/` spec directory. It
owns the Wallet server and Playwright child processes, waits for loopback
health after its own server's listening banner, then waits for both children to
close before deleting its validated temporary database directory. A port in
use fails rather than reusing someone else's server. Direct `playwright test`
has no development-server fallback. The parent and Node children receive the
offline network guard; inherited provider/auth/DB variables and `.env` are not
loaded into them. The app's AI mode is off.

Each default invocation allocates a new owned temporary directory. The old
`data/e2e.db` and default application `data/wallet.db` are never cleanup
targets. An explicit `DB_PATH` must be a new `.db` file under an existing
canonical parent and is reserved exclusively; existing files, protected
names, sidecars and known link aliases fail before startup. Explicit files
are retained for the caller, not removed with default temporary evidence.

## Controls and results

The initial regression-first control run was **0/5**: the fixed `e2e.db`
assertion failed as intended, while the other four could only report that the
new runner did not exist yet. Those four failures alone were not evidence of
specific old lifecycle behavior. Once the runner existed but before wiring,
the controls were **4/5**; the remaining failure correctly identified the old
config/CI entry. After wiring and moving service code outside browser specs,
the combined focused Node suite is **24/24 PASS** (12 E2E lifecycle and 12
existing verification controls). The unchanged static self-check is **8/8
PASS**, including C5. C5 scans browser-spec text; its green result does not
prove every runtime wait is web-first. Service readiness/shutdown uses bounded
timers separately from browser assertions.

The lifecycle controls cover distinct fresh defaults, explicit existing and
protected path rejection without changing sentinel bytes, hard-link refusal,
replacement-directory cleanup refusal, unconfirmed-child preservation, actual
child success and failure, an actual disposable Wallet server, a real retained
explicit override, occupied port, early/premature server exit, a signalled
browser and stripped inherited env.
After those controls and the unchanged self-check, exactly one full
`npm run test:e2e` was run on the pre-sidecar-guard local tree: **192/192 PASS** across
phone and desktop in 27.3 seconds. The parent reported confirmed server
closure and removal of its owned default directory. The old `data/e2e.db`
had the same file length and modification timestamp before and after; that
metadata check did not read its contents or prove byte identity. The default
application `data/wallet.db` remained absent. This is local execution, **not**
a new GitHub CI result.

## 2026-10-11 adjacent-sidecar correction

The first explicit-path checks rejected a sidecar **as the `DB_PATH` name** but
did not inspect a pre-existing `new.db-wal`, `new.db-shm` or `new.db-journal`
beside an otherwise new `new.db`. Three disposable probes accepted such a base
before the correction; none opened SQLite or touched an application database.
The new regression initially failed on `-wal` because the base was created.
The runner now uses `lstat` on all three adjacent names before exclusive `wx`
reservation, so a dangling symlink is also a collision rather than an absent
file. It does not read or delete the sidecar.

Final affected Node/verification controls: **26 passed, 1 skipped, 0 failed**.
All three regular sidecar cases passed both the allocation and no-child-start
checks, preserving sentinel bytes and file identity with the base absent. The
optional dangling-symlink fixture was skipped because this Windows session
cannot create that symlink; the code path is not claimed as executed here.
The unchanged static self-check is **8/8 PASS**. The **192/192** full browser
result above predates this guard; it was not rerun or relabelled as proof of
the newest source tree. Remote CI remains unverified.

## Remaining limits

The default local port is 3002, so two concurrent commands using that port
cannot both run; a safe `QA_E2E_PORT` can select another local port. A force-kill
of the parent can leave its ignored temporary directory. Later runs do not
sweep old names because they cannot prove ownership. A caller-specified new
database is retained even after a failed run. Node's network guard prevents
external Node TCP/TLS calls, not every possible browser-native request. This
sidecar preflight cannot prevent another process creating a sidecar after the
`lstat` checks and before SQLite opens the new base; no hostile-filesystem-race
guarantee is claimed. This
slice does not redesign AI or accessibility demo directories, and no remote
GitHub CI or artifact upload is inferred from local verification.
