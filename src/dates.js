'use strict';

// Pure date helpers. No I/O, no dependencies, and — apart from reading the
// clock in today() — deliberately no `Date` arithmetic at all. Every value here
// is a local calendar date held as plain numbers or as a 'YYYY-MM-DD' string.
//
// ALL DATES IN THIS APP ARE LOCAL DATES WITH NO TIMEZONE CONVERSION. This is a
// personal single-user app and the simplification is deliberate (spec §3) — it
// is a decision, not an accident.
//
// Two consequences worth stating, because both are easy to undo by accident:
//
//   1. A stored date must never be round-tripped through `new Date(string)`.
//      JavaScript reads 'YYYY-MM-DD' as UTC midnight, which lands on the
//      previous day for anyone west of Greenwich.
//   2. `new Date(2026, 1, 31)` does not throw. It silently rolls forward into
//      March. That is exactly the bug clampToMonth exists to prevent, so this
//      file does not construct Dates from a day number at all.
//
// This is the file with the real logic in it. Keep it pure.

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
const MONTH_LENGTHS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

const pad2 = (n) => String(n).padStart(2, '0');
const pad4 = (n) => String(n).padStart(4, '0');

function outOfRange(operation, detail) {
  const error = new RangeError(`${operation}: ${detail}`);
  error.code = 'DATE_OUT_OF_RANGE';
  throw error;
}

function assertYear(year, operation) {
  if (!Number.isInteger(year) || year < 0 || year > 9999) {
    outOfRange(operation, 'local calendar year must remain within 0000..9999');
  }
}

function assertMonth(month, operation) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    outOfRange(operation, 'calendar month must be 1..12');
  }
}

function assertDay(day, operation) {
  if (!Number.isInteger(day) || day < 1 || day > 31) {
    outOfRange(operation, 'calendar day must be 1..31 before month-end clamping');
  }
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/** Days in a month. `month` is 1-12. Returns 28, 29, 30 or 31. */
function daysInMonth(year, month) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return MONTH_LENGTHS[month - 1];
}

/** A date in (year, month), with the day pulled back to the last day that exists. */
function clampToMonth(year, month, day) {
  assertYear(year, 'clampToMonth');
  assertMonth(month, 'clampToMonth');
  assertDay(day, 'clampToMonth');
  return `${pad4(year)}-${pad2(month)}-${pad2(Math.min(day, daysInMonth(year, month)))}`;
}

function monthAfter(year, month) {
  assertYear(year, 'monthAfter');
  assertMonth(month, 'monthAfter');
  if (month === 12) {
    assertYear(year + 1, 'monthAfter');
    return { year: year + 1, month: 1 };
  }
  return { year, month: month + 1 };
}

/** 'YYYY-MM-DD' -> {year, month, day}, or null if it is not a real calendar date. */
function parseDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

const isValidDate = (value) => parseDate(value) !== null;

/**
 * The next date this schedule will be charged, on or after `fromDate`.
 *
 * CLAMP, NEVER SKIP: a schedule set to the 31st charges on 28 February — it
 * does not disappear in February. This is the case that breaks naive
 * implementations, and the seven rows in spec §4.1 are its acceptance criteria.
 */
function nextDue(dayOfMonth, fromDate) {
  const from = parseDate(fromDate);
  if (!from) throw new TypeError(`nextDue: fromDate must be YYYY-MM-DD, got ${fromDate}`);
  assertDay(dayOfMonth, 'nextDue');

  const candidate = clampToMonth(from.year, from.month, dayOfMonth);
  // ISO dates are fixed-width and zero-padded, so string order is date order.
  if (candidate >= fromDate) return candidate;

  const next = monthAfter(from.year, from.month);
  return clampToMonth(next.year, next.month, dayOfMonth);
}

/** Today, as a local 'YYYY-MM-DD'. The only place this module reads the clock. */
function today() {
  const now = new Date();
  const year = now.getFullYear();
  assertYear(year, 'today');
  return `${pad4(year)}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
}

/** The calendar day after `value`, rolling the month and year over correctly. */
function dayAfter(value) {
  const d = parseDate(value);
  if (!d) throw new TypeError(`dayAfter: expected YYYY-MM-DD, got ${value}`);
  if (d.day < daysInMonth(d.year, d.month)) {
    return `${pad4(d.year)}-${pad2(d.month)}-${pad2(d.day + 1)}`;
  }
  const next = monthAfter(d.year, d.month);
  return `${pad4(next.year)}-${pad2(next.month)}-01`;
}

/** 'YYYY-MM' -> {from, to} covering that whole month, or null if malformed. */
function monthBounds(value) {
  if (typeof value !== 'string' || !MONTH_RE.test(value)) return null;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  if (month < 1 || month > 12) return null;
  return { from: `${value}-01`, to: `${value}-${pad2(daysInMonth(year, month))}` };
}

/** The current month as 'YYYY-MM'. */
const currentMonth = () => today().slice(0, 7);

/** The later of two 'YYYY-MM-DD' strings. */
const laterOf = (a, b) => (a > b ? a : b);

module.exports = {
  isLeapYear,
  daysInMonth,
  clampToMonth,
  monthAfter,
  parseDate,
  isValidDate,
  nextDue,
  today,
  dayAfter,
  monthBounds,
  currentMonth,
  laterOf,
};
