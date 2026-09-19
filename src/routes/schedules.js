'use strict';

const express = require('express');
const { db } = require('../db');
const { nextDue, today, laterOf } = require('../dates');
const v = require('../validate');

const router = express.Router();

/**
 * Turn a stored row into the API shape.
 *
 * next_due, remaining_count and remaining_cents are COMPUTED HERE, NEVER
 * STORED (spec §5). A stored derived value goes stale the moment the clock
 * moves or an instalment is paid, and stale derived data is a bug class worth
 * designing out rather than fixing later.
 *
 * remaining_* are null for a subscription, because "how many left" has no
 * answer when the schedule never ends.
 */
function shape(row) {
  const isLoan = row.total_count !== null;
  const remainingCount = isLoan ? row.total_count - row.paid_count : null;

  return {
    id: row.id,
    name: row.name,
    amount_cents: row.amount_cents,
    category_id: row.category_id,
    day_of_month: row.day_of_month,
    starts_on: row.starts_on,
    // A schedule that has not started yet is next due on or after its start
    // date, not today.
    next_due: nextDue(row.day_of_month, laterOf(today(), row.starts_on)),
    total_count: row.total_count,
    paid_count: row.paid_count,
    remaining_count: remainingCount,
    remaining_cents: isLoan ? remainingCount * row.amount_cents : null,
    active: row.active,
  };
}

const findForUser = (id, userId) =>
  db.prepare('SELECT * FROM schedules WHERE id = ? AND user_id = ?').get(id, userId);

// POST /api/schedules
router.post('/', (req, res) => {
  const body = req.body || {};
  const name = v.name(body.name);
  const amountCents = v.amountCents(body.amount_cents);
  const categoryId = v.ownedCategoryId(body.category_id, req.userId);
  const dayOfMonth = v.dayOfMonth(body.day_of_month);
  const startsOn = v.startsOn(body.starts_on);
  const totalCount = v.totalCount(body.total_count);

  const info = db
    .prepare(
      `INSERT INTO schedules
         (user_id, name, amount_cents, category_id, day_of_month, starts_on, total_count)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(req.userId, name, amountCents, categoryId, dayOfMonth, startsOn, totalCount);

  res.status(201).json(shape(findForUser(Number(info.lastInsertRowid), req.userId)));
});

// GET /api/schedules?active=1
router.get('/', (req, res) => {
  const activeOnly = req.query.active === '1';
  const rows = db
    .prepare(
      `SELECT * FROM schedules WHERE user_id = ?${activeOnly ? ' AND active = 1' : ''}`
    )
    .all(req.userId);

  // Sorted in JS rather than in SQL: next_due is computed, so there is no
  // column to ORDER BY. See D-007.
  const items = rows.map(shape).sort((a, b) => a.next_due.localeCompare(b.next_due));
  res.status(200).json(items);
});

// PATCH /api/schedules/:id/pay
//
// Registered before PATCH /:id. Express matches on segment count so the two
// cannot collide, but reading them in this order makes that obvious instead of
// something the next reader has to work out.
router.patch('/:id/pay', (req, res) => {
  const id = v.id(req.params.id, 'id');

  // The read, the checks and the writes are ALL inside the transaction.
  //
  // They used to be split: the row was read here, then a transaction used the
  // values it had read. On this stack that is safe *by accident* —
  // better-sqlite3 is synchronous and this handler never yields, so no second
  // request can run between the read and the write.
  //
  // It stops being safe in two ways, neither exotic and neither announcing
  // itself: a second server process sharing the database file (measured — it
  // works, and qa/race/ runs against exactly that), or an `await` added
  // anywhere between the read and the write. The login route already has one.
  // See D-030.
  const pay = db.transaction(() => {
    const schedule = findForUser(id, req.userId);
    if (!schedule) throw v.notFound(`No schedule with id ${id}`);

    // Paying a closed loan is a state conflict, not a malformed request — 409,
    // not 400 (spec §4.2).
    if (schedule.active === 0) {
      throw v.conflict('This schedule is no longer active and cannot be paid');
    }

    const txInfo = db
      .prepare(
        `INSERT INTO transactions
           (user_id, amount_cents, category_id, spent_on, note, schedule_id)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        schedule.user_id,
        schedule.amount_cents,
        schedule.category_id,
        today(),
        schedule.name,
        schedule.id
      );

    const paidCount = schedule.paid_count + 1;
    const finished = schedule.total_count !== null && paidCount >= schedule.total_count;

    db.prepare('UPDATE schedules SET paid_count = ?, active = ? WHERE id = ?')
      .run(paidCount, finished ? 0 : 1, schedule.id);

    return {
      paid_count: paidCount,
      remaining_count: schedule.total_count === null ? null : schedule.total_count - paidCount,
      finished,
      transaction_id: Number(txInfo.lastInsertRowid),
    };
  });

  // .immediate(), not the default deferred BEGIN. A deferred transaction takes
  // a read lock and upgrades it on the first write, and if another connection
  // wrote in between, SQLite refuses with SQLITE_BUSY *immediately* — busy_timeout
  // does not apply, because waiting cannot fix a stale snapshot. BEGIN IMMEDIATE
  // takes the write lock up front, where the timeout does apply. Measured: 4 of 40
  // cross-process pairs answered 500 without it (BUG-012).
  res.status(200).json(pay.immediate());
});

// What a client may change, and what it may not (spec §5, D-029).
const EDITABLE = [
  'name', 'amount_cents', 'category_id', 'day_of_month', 'starts_on', 'total_count',
];
const SERVER_OWNED = ['id', 'user_id', 'paid_count', 'active'];

// PATCH /api/schedules/:id
router.patch('/:id', (req, res) => {
  const id = v.id(req.params.id, 'id');
  const body = req.body || {};
  const given = v.patchFields(body, { allowed: EDITABLE, serverOwned: SERVER_OWNED });

  // Field validation happens before the transaction opens: a malformed request
  // should not hold a write lock, however briefly, and none of these validators
  // reads the row being edited.
  const sets = [];
  const params = [];
  const set = (column, value) => { sets.push(`${column} = ?`); params.push(value); };

  if (given.includes('name')) set('name', v.name(body.name));
  if (given.includes('amount_cents')) set('amount_cents', v.amountCents(body.amount_cents));
  if (given.includes('category_id')) set('category_id', v.ownedCategoryId(body.category_id, req.userId));
  if (given.includes('day_of_month')) set('day_of_month', v.dayOfMonth(body.day_of_month));
  if (given.includes('starts_on')) set('starts_on', v.startsOn(body.starts_on));

  const newTotalCount = given.includes('total_count') ? v.totalCount(body.total_count) : undefined;

  // Read, decide and write in one transaction. The 409 below is a comparison
  // between something sent by the client and something stored in the row, which
  // is precisely the check that must not be able to go stale between being made
  // and being acted on (D-030).
  const edit = db.transaction(() => {
    const before = findForUser(id, req.userId);
    if (!before) throw v.notFound(`No schedule with id ${id}`);

    const totalCount = newTotalCount === undefined ? before.total_count : newTotalCount;

    if (totalCount !== null && totalCount < before.paid_count) {
      throw v.conflict(
        `total_count cannot be ${totalCount}: ${before.paid_count} instalments have already been paid`
      );
    }

    if (newTotalCount !== undefined) set('total_count', newTotalCount);

    // `active` is DERIVED here rather than preserved. A loan whose total_count
    // is raised above its paid_count has instalments left again, and a row that
    // says active = 0 while remaining_count is 2 is incoherent — the same class
    // of staleness §5 avoids by never storing next_due. Setting total_count
    // equal to paid_count finishes the loan, which is the last payment's arrow
    // reached from the other direction.
    const active = totalCount !== null && before.paid_count >= totalCount ? 0 : 1;
    if (active !== before.active) set('active', active);

    db.prepare(`UPDATE schedules SET ${sets.join(', ')} WHERE id = ? AND user_id = ?`)
      .run(...params, id, req.userId);

    return shape(findForUser(id, req.userId));
  });

  res.status(200).json(edit.immediate());
});

module.exports = router;
