'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const dates = require('../../src/dates');

const overflow = (fn) => assert.throws(fn, (err) =>
  err instanceof RangeError && err.code === 'DATE_OUT_OF_RANGE' && /9999/.test(err.message));

test('accepted year 0000 and early years stay four digits through clamping and rollover', () => {
  for (const value of ['0000-01-01', '0000-02-29', '0001-01-31', '0099-12-31', '0100-01-01', '0999-12-31', '1000-01-01', '9999-12-31']) {
    assert.equal(dates.isValidDate(value), true, value);
    assert.deepEqual(dates.parseDate(value).year, Number(value.slice(0, 4)));
  }
  assert.equal(dates.isValidDate('10000-01-01'), false);
  assert.equal(dates.isValidDate('0001-02-29'), false);
  assert.equal(dates.clampToMonth(0, 2, 31), '0000-02-29');
  assert.equal(dates.clampToMonth(1, 2, 31), '0001-02-28');
  assert.equal(dates.dayAfter('0000-01-31'), '0000-02-01');
  assert.equal(dates.dayAfter('0001-01-31'), '0001-02-01');
  assert.equal(dates.dayAfter('0099-12-31'), '0100-01-01');
  assert.equal(dates.dayAfter('0999-12-31'), '1000-01-01');
  assert.equal(dates.nextDue(15, '0001-01-31'), '0001-02-15');
  assert.equal(dates.nextDue(31, '0000-02-01'), '0000-02-29');
  assert.deepEqual(dates.monthBounds('0000-02'), { from: '0000-02-01', to: '0000-02-29' });
  assert.deepEqual(dates.monthBounds('9999-12'), { from: '9999-12-01', to: '9999-12-31' });
});

test('max valid date stays valid while nonexistent successor is explicitly refused', () => {
  assert.equal(dates.nextDue(31, '9999-12-31'), '9999-12-31');
  overflow(() => dates.dayAfter('9999-12-31'));
  overflow(() => dates.monthAfter(9999, 12));
  overflow(() => dates.nextDue(15, '9999-12-31'));
  overflow(() => dates.clampToMonth(10000, 1, 1));
  assert.throws(() => dates.clampToMonth(0, 13, 1), { code: 'DATE_OUT_OF_RANGE' });
  assert.throws(() => dates.monthAfter(1, 0), { code: 'DATE_OUT_OF_RANGE' });
  assert.throws(() => dates.nextDue(0, '0001-01-01'), { code: 'DATE_OUT_OF_RANGE' });
});

test('ordinary leap and month-end behavior remains timezone-free', () => {
  assert.equal(dates.dayAfter('2000-02-28'), '2000-02-29');
  assert.equal(dates.dayAfter('1900-02-28'), '1900-03-01');
  assert.equal(dates.nextDue(31, '2024-02-01'), '2024-02-29');
  assert.equal(dates.nextDue(31, '2024-02-29'), '2024-02-29');
  assert.equal(dates.nextDue(31, '2024-03-01'), '2024-03-31');
  assert.equal(dates.monthBounds('2024-02').to, '2024-02-29');
});

test('today preserves the four-digit clock year and refuses an out-of-domain clock', () => {
  const RealDate = global.Date;
  try {
    global.Date = class { getFullYear() { return 0; } getMonth() { return 0; } getDate() { return 1; } };
    assert.equal(dates.today(), '0000-01-01');
    global.Date = class { getFullYear() { return 9999; } getMonth() { return 11; } getDate() { return 31; } };
    assert.equal(dates.today(), '9999-12-31');
    global.Date = class { getFullYear() { return 10000; } getMonth() { return 0; } getDate() { return 1; } };
    overflow(() => dates.today());
  } finally { global.Date = RealDate; }
});
