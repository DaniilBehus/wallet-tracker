#!/usr/bin/env node
'use strict';

/*
 * Concurrency checks: two requests aimed at one row at the same moment.
 *
 *   npm run test:race
 *
 * ---------------------------------------------------------------------------
 * Why this is its own layer, and not a folder in qa/api/.
 *
 * newman runs a collection one request at a time. That is the right model for
 * a contract, and it is structurally incapable of expressing "these two arrive
 * together" — the only question this file asks. Playwright could drive two
 * browser contexts, but then the thing being measured is buried under two
 * renderers and a network stack.
 *
 * So: a small client that fires pairs of requests with Promise.all and then
 * asks whether the data that came out is possible.
 *
 * ---------------------------------------------------------------------------
 * What is actually being tested, stated precisely, because "test the race" is
 * not a testable sentence.
 *
 * Three scenarios, each an invariant rather than an expected value. A race has
 * no expected value — that is what makes it a race. It has outcomes that are
 * allowed and outcomes that are not:
 *
 *   A · pay vs edit      Two tabs: one pays a loan, one changes its amount.
 *                        ALLOWED:  the payment charges the old amount, or the
 *                                  new one. Both are a coherent ordering.
 *                        FORBIDDEN: paid_count moving by anything other than
 *                                  exactly one per successful payment; a
 *                                  charge for an amount that was never set; a
 *                                  finished loan with instalments left; a 5xx.
 *
 *   B · edit vs delete   Two tabs: one edits an expense, one deletes it.
 *                        ALLOWED:  the edit lands and then the row is deleted
 *                                  (200 + 204), or the row is deleted first and
 *                                  the edit finds nothing (404 + 204).
 *                        FORBIDDEN: the row surviving; a 200 edit on a row that
 *                                  is gone AND a 404 delete; any 5xx.
 *
 *   C · A, across two    The same pairs, but the two requests go to two
 *       server processes SEPARATE server processes sharing one database file.
 *                        Same invariants. This is the scenario that asks
 *                        whether the protection is in the code or in the
 *                        runtime, and it is the reason this file exists at all.
 *
 * No dependencies (spec §2). Node built-ins only.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const REPORT_DIR = path.join(ROOT, 'qa', 'reports');

const PORTS = [3110, 3111];
const DB_PATH = path.join(ROOT, 'data', `race-${Date.now()}.db`);
const SECRET = crypto.randomBytes(48).toString('hex');
const PAIRS = Number(process.env.RACE_PAIRS || 120);

const servers = [];
const problems = [];

// --------------------------------------------------------------------- setup
function sweepOldDatabases() {
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('race-')) continue;
    try { fs.rmSync(path.join(dir, name), { force: true }); } catch { /* still held */ }
  }
}

function startServer(port) {
  const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), DB_PATH, JWT_SECRET: SECRET },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  let gone = false;
  server.once('exit', () => { gone = true; });
  servers.push({ server, isGone: () => gone });
  return server;
}

async function waitForServer(port) {
  const deadline = Date.now() + 30000;
  let last = 'no attempt made';
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/api/health`);
      if (res.ok) return;
      last = `HTTP ${res.status}`;
    } catch (err) { last = err.message; }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`the server on port ${port} never became healthy (${last})`);
}

// -------------------------------------------------------------------- client
function client(port, token) {
  return async (method, route, body) => {
    const res = await fetch(`http://localhost:${port}/api${route}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let data = null;
    try { data = await res.json(); } catch { /* 204 has no body */ }
    return { status: res.status, data };
  };
}

const tally = (map, key) => map.set(key, (map.get(key) || 0) + 1);

function printTally(title, map) {
  console.log(`  ${title}`);
  for (const [key, n] of [...map.entries()].sort()) {
    console.log(`    ${String(n).padStart(4)} × ${key}`);
  }
}

// ---------------------------------------------------------------- scenario A
/**
 * Pay a loan while its amount is being changed.
 *
 * Each pair gets a fresh schedule, because a race that runs against a row the
 * previous pair already moved is measuring the sum of two experiments.
 */
async function payVsEdit(api, apiB, label) {
  const outcomes = new Map();
  let violations = 0;

  const cats = await api('GET', '/categories');
  const categoryId = cats.data[0].id;

  for (let i = 0; i < PAIRS; i++) {
    const made = await api('POST', '/schedules', {
      name: `Race ${i}`,
      amount_cents: 10000,
      category_id: categoryId,
      day_of_month: 10,
      starts_on: '2026-01-10',
      total_count: 5,
    });
    const id = made.data.id;

    const [pay, edit] = await Promise.all([
      api('PATCH', `/schedules/${id}/pay`),
      apiB('PATCH', `/schedules/${id}`, { amount_cents: 20000 }),
    ]);

    tally(outcomes, `pay ${pay.status} · edit ${edit.status}`);

    const after = await api('GET', '/schedules');
    const row = after.data.find((s) => s.id === id);
    const txs = await api('GET', '/transactions?limit=200');
    const charge = txs.data.items.find((t) => t.schedule_id === id);

    // --- the invariants
    if (pay.status >= 500 || edit.status >= 500) {
      problems.push(`${label} pair ${i}: a 5xx (pay ${pay.status}, edit ${edit.status})`);
      violations++;
      continue;
    }
    if (pay.status === 200) {
      if (!charge) {
        problems.push(`${label} pair ${i}: payment answered 200 and charged nothing`);
        violations++;
      } else if (charge.amount_cents !== 10000 && charge.amount_cents !== 20000) {
        problems.push(
          `${label} pair ${i}: charged ${charge.amount_cents}, which was never the amount`);
        violations++;
      }
      if (row && row.paid_count !== 1) {
        problems.push(`${label} pair ${i}: one payment moved paid_count to ${row.paid_count}`);
        violations++;
      }
    }
    if (pay.status !== 200 && charge) {
      problems.push(`${label} pair ${i}: payment answered ${pay.status} and charged anyway`);
      violations++;
    }
    if (row && row.active === 0 && row.remaining_count > 0) {
      problems.push(
        `${label} pair ${i}: finished with ${row.remaining_count} instalments left`);
      violations++;
    }
  }

  return { outcomes, violations };
}

// ---------------------------------------------------------------- scenario B
/**
 * `order` exists because the first version of this reported 40 identical
 * outcomes — `edit 404 · delete 204`, every single time. That is not a race
 * being observed; it is one fixed ordering observed forty times, and a test
 * that can only reach one of two legal branches is not covering the other.
 *
 * The obvious explanation was wrong. Swapping the `Promise.all` array order
 * changed nothing — B2 gives the same 40 × `edit 404`. So arrival order is NOT
 * decided by which fetch is started first. The likeliest remaining reason is
 * that a DELETE carries no body and reaches the socket sooner than a PATCH that
 * has to serialise one, but that is a hypothesis and is written here as one.
 *
 * What follows is the honest part: the `edit 200 · delete 204` branch cannot be
 * reached by racing on this stack, so B3 covers it with `stagger` — a
 * deliberate few milliseconds, which is a forced ordering and not a race. Said
 * out loud, because a suite that never reaches a branch and a suite that
 * reaches it on purpose look identical in a pass count.
 */
async function editVsDelete(api, apiB, label, order, stagger = 0) {
  const outcomes = new Map();
  let violations = 0;

  const cats = await api('GET', '/categories');
  const categoryId = cats.data[0].id;

  for (let i = 0; i < PAIRS; i++) {
    const made = await api('POST', '/transactions', {
      amount_cents: 1500,
      category_id: categoryId,
      note: 'before',
    });
    const id = made.data.id;

    const sendEdit = () => api('PATCH', `/transactions/${id}`, { note: 'after', amount_cents: 2500 });
    const sendDelete = () => apiB('DELETE', `/transactions/${id}`);

    let edit, del;
    if (stagger > 0) {
      // Not a race: the edit is given a head start on purpose, to reach the
      // branch that racing never produces.
      const editing = sendEdit();
      await new Promise((r) => setTimeout(r, stagger));
      [edit, del] = await Promise.all([editing, sendDelete()]);
    } else if (order === 'delete-first') {
      [del, edit] = await Promise.all([sendDelete(), sendEdit()]);
    } else {
      [edit, del] = await Promise.all([sendEdit(), sendDelete()]);
    }

    tally(outcomes, `edit ${edit.status} · delete ${del.status}`);

    const still = await api('GET', `/transactions?limit=200`);
    const survivor = still.data.items.find((t) => t.id === id);

    if (edit.status >= 500 || del.status >= 500) {
      problems.push(`${label} pair ${i}: a 5xx (edit ${edit.status}, delete ${del.status})`);
      violations++;
      continue;
    }
    if (survivor) {
      problems.push(
        `${label} pair ${i}: the row survived a delete that answered ${del.status}`);
      violations++;
    }
    if (edit.status === 200 && del.status === 404) {
      problems.push(
        `${label} pair ${i}: the edit succeeded and the delete found nothing — ` +
        'the row was edited into somewhere the delete could not see it');
      violations++;
    }
    if (![200, 404].includes(edit.status)) {
      problems.push(`${label} pair ${i}: edit answered ${edit.status}, expected 200 or 404`);
      violations++;
    }
  }

  return { outcomes, violations };
}

// ---------------------------------------------------------------- scenario D
/**
 * The same POST, twice, as fast as the client can send it — a network retry.
 *
 * There is no expected value to assert here, only a question with two possible
 * answers, and BOTH are worth knowing:
 *
 *   two rows  — nothing deduplicates, and a retried request costs the user a
 *               duplicate expense they did not make. What to do about that is
 *               a decision, not a bug fix.
 *   one row   — something rejects the second one, and the report has to name
 *               WHICH check did it, because a protection nobody can point at is
 *               a coincidence waiting to be refactored away.
 *
 * This scenario therefore does not fail the run either way. It measures, and
 * the number goes in the report.
 */
async function doubleSubmit(api) {
  const outcomes = new Map();
  const cats = await api('GET', '/categories');
  const categoryId = cats.data[0].id;
  let duplicated = 0;

  for (let i = 0; i < PAIRS; i++) {
    const body = {
      amount_cents: 1234,
      category_id: categoryId,
      spent_on: '2026-02-14',
      note: `retry probe ${i}`,
    };

    const [first, second] = await Promise.all([
      api('POST', '/transactions', body),
      api('POST', '/transactions', body),
    ]);

    tally(outcomes, `${first.status} · ${second.status}`);

    const all = await api('GET', '/transactions?from=2026-02-14&to=2026-02-14&limit=200');
    const matching = all.data.items.filter((t) => t.note === body.note);
    tally(outcomes, `${matching.length} row(s) stored`);
    if (matching.length > 1) duplicated++;

    for (const row of matching) await api('DELETE', `/transactions/${row.id}`);
  }

  return { outcomes, duplicated, violations: 0 };
}

// --------------------------------------------------------------------- main
async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  sweepOldDatabases();

  for (const port of PORTS) startServer(port);
  let code = 1;
  const summary = {};

  try {
    for (const port of PORTS) await waitForServer(port);
    console.log(`two servers on ${PORTS.join(' and ')}, one database: ` +
      `${path.relative(ROOT, DB_PATH)}`);
    console.log(`${PAIRS} pairs per scenario\n`);

    const anon = client(PORTS[0], null);
    const reg = await anon('POST', '/auth/register', {
      email: `race-${Date.now()}@example.com`,
      password: 'password123',
    });
    const token = reg.data.token;

    const a0 = client(PORTS[0], token);
    const a1 = client(PORTS[1], token);

    console.log('A · pay a loan while its amount is edited — one process');
    const a = await payVsEdit(a0, a0, 'A');
    printTally('outcomes', a.outcomes);
    console.log(`    violations: ${a.violations}\n`);

    console.log('B1 · edit an expense while it is deleted — edit sent first');
    const b = await editVsDelete(a0, a0, 'B1', 'edit-first');
    printTally('outcomes', b.outcomes);
    console.log(`    violations: ${b.violations}\n`);

    console.log('B2 · the same pair, delete sent first');
    const b2 = await editVsDelete(a0, a0, 'B2', 'delete-first');
    printTally('outcomes', b2.outcomes);
    console.log(`    violations: ${b2.violations}\n`);

    console.log('B3 · edit given a 5 ms head start — a FORCED ordering, not a race');
    const b3 = await editVsDelete(a0, a0, 'B3', 'edit-first', 5);
    printTally('outcomes', b3.outcomes);
    console.log(`    violations: ${b3.violations}\n`);

    console.log('C · pay vs edit — TWO processes, one database file');
    const c = await payVsEdit(a0, a1, 'C');
    printTally('outcomes', c.outcomes);
    console.log(`    violations: ${c.violations}\n`);

    console.log('D · the same POST twice, as a network retry would send it');
    const d = await doubleSubmit(a0);
    printTally('outcomes', d.outcomes);
    console.log('    pairs that produced a duplicate row: ' + d.duplicated + ' of ' + PAIRS);
    console.log('    (measured, not asserted — see the report)');
    console.log('');

    summary.pairs = PAIRS;
    summary.scenarios = {
      A: { outcomes: Object.fromEntries(a.outcomes), violations: a.violations },
      B1: { outcomes: Object.fromEntries(b.outcomes), violations: b.violations },
      B2: { outcomes: Object.fromEntries(b2.outcomes), violations: b2.violations },
      B3: { outcomes: Object.fromEntries(b3.outcomes), violations: b3.violations, forced: true },
      C: { outcomes: Object.fromEntries(c.outcomes), violations: c.violations },
      D: { outcomes: Object.fromEntries(d.outcomes), duplicated: d.duplicated, measuredOnly: true },
    };
    fs.writeFileSync(
      path.join(REPORT_DIR, 'race-summary.json'),
      JSON.stringify(summary, null, 2)
    );

    const total = a.violations + b.violations + b2.violations + b3.violations + c.violations;
    if (total === 0) {
      console.log('no invariant was violated in any scenario');
      code = 0;
    } else {
      console.log(`${total} invariant violations:`);
      for (const p of problems.slice(0, 20)) console.log(`  ${p}`);
      if (problems.length > 20) console.log(`  … and ${problems.length - 20} more`);
      code = 1;
    }
    console.log(`summary: ${path.relative(ROOT, path.join(REPORT_DIR, 'race-summary.json'))}`);
  } catch (err) {
    console.error(err.message);
    code = 1;
  }

  // The result is recorded before any cleanup and nothing below may change it
  // (R8, and the two ways it has already been broken: BUG-008 and BUG-010).
  process.exitCode = code;

  for (const { server, isGone } of servers) {
    if (isGone()) continue;
    await new Promise((resolve) => {
      server.once('exit', resolve);
      const giveUp = setTimeout(resolve, 5000);
      giveUp.unref();
      server.kill();
    });
  }
}

main();
