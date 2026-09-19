'use strict';

// Pure tests of src/ai/normalize.js. The probes here were written separately
// from the evaluation corpus: different sentences, different numbers, and an
// independent calendar oracle. Agreeing with the corpus proves the labels and
// the rules match; these prove the rules do what the contract says.

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', '..', 'src');
const n = require(path.join(SRC, 'ai', 'normalize'));

const NAMES = ['Groceries', 'Transport', 'Housing', 'Restaurants', 'Health', 'Clothing', 'Entertainment', 'Phone & internet', 'Education', 'Other'];
const REFS = new Map(NAMES.map((_, i) => [`c${i}`, 500 + i]));
const TODAY = '2026-09-14';

function out(partial) {
  return {
    intent: 'expense', language: 'en', amount_text: null, currency_text: null,
    date_text: null, category_ref: null, note_text: null, ...partial,
  };
}
const run = (text, output, referenceDate = TODAY, serverToday = TODAY) =>
  n.derive({ text, referenceDate, serverToday, output: out(output), refs: REFS });
const codes = (r) => r.issues.map((i) => i.code);

// ------------------------------------------------------------------ money

test('money tokens convert to exact integer cents', () => {
  const table = [
    ['0.01', 1], ['0.10', 10], ['0,5', 50], ['18.50', 1850], ['7', 700],
    ['1 234,56', 123456], ['1 234.56', 123456], ['1 234', 123400],
    ['999999.99', 99999999], ['1000000', 100000000], ['007', 700],
  ];
  for (const [token, cents] of table) {
    assert.deepEqual(n.parseMoneyToken(token), { cents }, token);
  }
});

test('money tokens outside the contract are refused, never rounded or clipped', () => {
  const table = [
    ['0', 'INVALID_AMOUNT'], ['0.00', 'INVALID_AMOUNT'], ['1000000.01', 'AMOUNT_OUT_OF_RANGE'],
    ['12345678', 'AMOUNT_OUT_OF_RANGE'], ['1.005', 'AMBIGUOUS_AMOUNT'], ['12,345', 'AMBIGUOUS_AMOUNT'],
    ['1.2345', 'AMBIGUOUS_AMOUNT'], ['1.234,56', 'AMBIGUOUS_AMOUNT'], ['1,234.56', 'AMBIGUOUS_AMOUNT'],
    ['1.234.567', 'AMBIGUOUS_AMOUNT'], ['1 234,567', 'AMBIGUOUS_AMOUNT'],
  ];
  for (const [token, issue] of table) {
    assert.deepEqual(n.parseMoneyToken(token), { issue }, token);
  }
});

test('an exponent or a sign is never a money token', () => {
  const r = run('Tea 1e3 EUR', { amount_text: '1', currency_text: 'EUR', category_ref: 'c3' });
  assert.equal(r.draft.amount_cents, null);
  assert.equal(r.status, 'needs_input');
});

test('a number inside a larger number is a contract violation (180 is not 18)', () => {
  assert.throws(
    () => run('Dinner 180 EUR', { amount_text: '18', currency_text: 'EUR', category_ref: 'c3' }),
    (e) => e instanceof n.ContractViolation && /whole number/.test(e.message)
  );
  assert.throws(
    () => run('Dinner 18.50 EUR', { amount_text: '18', currency_text: 'EUR', category_ref: 'c3' }),
    n.ContractViolation
  );
});

test('text the description does not contain is a contract violation', () => {
  assert.throws(() => run('Lunch yesterday', { amount_text: '12', date_text: 'yesterday' }), n.ContractViolation);
  assert.throws(() => run('Lunch 9 EUR', { amount_text: '9', note_text: 'Business lunch with client' }), n.ContractViolation);
  assert.throws(() => run('Lunch 9 EUR', { amount_text: '9', category_ref: 'c77' }), n.ContractViolation);
});

test('a missing amount is never invented; a written-out amount asks for digits', () => {
  const a = run('Bus pass', { category_ref: 'c1', note_text: 'Bus pass' });
  assert.equal(a.draft.amount_cents, null);
  assert.ok(codes(a).includes('AMOUNT_REQUIRED'));
  const b = run('Bus pass twelve euros', { category_ref: 'c1', currency_text: 'euros' });
  assert.ok(codes(b).includes('NUMERIC_AMOUNT_REQUIRED'));
});

test('model and scan disagreeing about the amount yields a question, not either value', () => {
  // One currency-marked total; the model picked the quantity.
  const r = run('3 tickets for 27 EUR', { amount_text: '3', currency_text: 'EUR', category_ref: 'c6' });
  assert.equal(r.draft.amount_cents, null);
  assert.ok(codes(r).includes('AMBIGUOUS_AMOUNT'));
  // Model returned no amount although the text has one.
  const s = run('Taxi 14 EUR', { amount_text: null, currency_text: 'EUR', category_ref: 'c1' });
  assert.ok(codes(s).includes('AMBIGUOUS_AMOUNT'));
});

test('a currency marker on either side of the number is recognised', () => {
  assert.equal(run('Tea €3.40', { amount_text: '3.40', currency_text: '€', category_ref: 'c3' }).draft.amount_cents, 340);
  assert.equal(run('Tea EUR 3,40', { amount_text: '3,40', currency_text: 'EUR', category_ref: 'c3' }).draft.amount_cents, 340);
  assert.equal(run('Tea 3,40€', { amount_text: '3,40€', currency_text: '€', category_ref: 'c3' }).draft.amount_cents, 340);
});

test('negative, approximate, alternative and arithmetic amounts stay empty', () => {
  const table = [
    ['Parking −4 EUR', '4', 'INVALID_AMOUNT'],
    ['Parking roughly 4 EUR', '4', 'APPROXIMATE_AMOUNT'],
    ['Parking ~4 EUR', '4', 'APPROXIMATE_AMOUNT'],
    ['Parking 4-6 EUR', '6', 'AMBIGUOUS_AMOUNT'],
    ['Parking 4 to 6 EUR', '6', 'AMBIGUOUS_AMOUNT'],
    ['Parking 10 EUR plus 2 tip', '10', 'AMBIGUOUS_AMOUNT'],
  ];
  for (const [text, amount, issue] of table) {
    const r = run(text, { amount_text: amount, currency_text: 'EUR', category_ref: 'c1' });
    assert.equal(r.draft.amount_cents, null, text);
    assert.ok(codes(r).includes(issue), `${text}: ${codes(r)}`);
  }
});

// ---------------------------------------------------------------- currency

test('an explicit foreign currency is unsupported even when the model reports none', () => {
  for (const text of ['Taxi $10', 'Taxi 10 dollars', 'Taxi 10 CHF', 'Taxi 10 ₴', 'Taxi 10 Ft']) {
    const r = run(text, { amount_text: '10', currency_text: null, category_ref: 'c1' });
    assert.equal(r.status, 'unsupported', text);
    assert.ok(codes(r).includes('UNSUPPORTED_CURRENCY'), text);
    assert.deepEqual(r.draft, { amount_cents: null, category_id: null, spent_on: null, note: null }, text);
  }
});

test('a currency word the vocabulary does not know is ambiguous, not EUR', () => {
  const r = run('Taxi 10 krones', { amount_text: '10', currency_text: 'krones', category_ref: 'c1' });
  assert.equal(r.status, 'needs_input');
  assert.ok(codes(r).includes('AMBIGUOUS_CURRENCY'));
  assert.equal(r.provenance.currency, 'none');
});

test('no currency at all defaults to EUR visibly', () => {
  const r = run('Taxi 10 today', { amount_text: '10', date_text: 'today', category_ref: 'c1' });
  assert.equal(r.status, 'ready');
  assert.equal(r.provenance.currency, 'default');
  assert.ok(codes(r).includes('CURRENCY_DEFAULTED'));
});

test('two currency-marked amounts are several expenses', () => {
  const r = run('Tea 3 EUR, cake 4 EUR', { amount_text: '3', currency_text: 'EUR', category_ref: 'c3' });
  assert.equal(r.status, 'unsupported');
  assert.ok(codes(r).includes('MULTIPLE_EXPENSES'));
});

// ------------------------------------------------------------------- dates

test('dayBefore agrees with an independent Date oracle for 1900-2100', () => {
  const pad = (x, w = 2) => String(x).padStart(w, '0');
  let checked = 0;
  for (let t = Date.UTC(1900, 0, 2); t <= Date.UTC(2100, 11, 31); t += 86400000) {
    const d = new Date(t);
    const prev = new Date(t - 86400000);
    const iso = `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
    const expected = `${pad(prev.getUTCFullYear(), 4)}-${pad(prev.getUTCMonth() + 1)}-${pad(prev.getUTCDate())}`;
    assert.equal(n.dayBefore(iso), expected);
    checked += 1;
  }
  assert.ok(checked > 73000);
});

test('relative dates follow the reference date across month, year and leap boundaries', () => {
  const table = [
    ['Metro ticket 2 EUR yesterday', 'yesterday', '2024-03-01', '2024-02-29'],
    ['Metro ticket 2 EUR yesterday', 'yesterday', '2100-03-01', '2100-02-28'],
    ['Metro ticket 2 EUR predvčerom', 'predvčerom', '2027-01-02', '2026-12-31'],
    ['Metro ticket 2 EUR позавчора', 'позавчора', '2026-03-02', '2026-02-28'],
    ['Metro ticket 2 EUR dnes', 'dnes', '2026-12-31', '2026-12-31'],
  ];
  for (const [text, dateText, ref, expected] of table) {
    const r = run(text, { amount_text: '2', currency_text: 'EUR', date_text: dateText, category_ref: 'c1' }, ref, ref);
    assert.equal(r.draft.spent_on, expected, `${dateText} from ${ref}`);
  }
});

test('an explicit date that cannot be used is never replaced by today', () => {
  const table = [
    ['Gift 20 EUR on 2026-02-30', '2026-02-30', 'INVALID_DATE'],
    ['Gift 20 EUR on 30.2.2026', '30.2.2026', 'INVALID_DATE'],
    ['Gift 20 EUR on 3/4/2026', '3/4/2026', 'AMBIGUOUS_DATE'],
    ['Gift 20 EUR on 3.4', '3.4', 'UNSUPPORTED_DATE_FORMAT'],
    ['Gift 20 EUR last week', 'last week', 'UNSUPPORTED_DATE_FORMAT'],
    ['Gift 20 EUR on 12 September', '12 September', 'UNSUPPORTED_DATE_FORMAT'],
    ['Gift 20 EUR on 1899-12-31', '1899-12-31', 'DATE_OUT_OF_RANGE'],
    ['Gift 20 EUR today on 2026-09-01', 'today', 'AMBIGUOUS_DATE'],
  ];
  for (const [text, dateText, issue] of table) {
    const r = run(text, { amount_text: '20', currency_text: 'EUR', date_text: dateText, category_ref: 'c9' });
    assert.equal(r.draft.spent_on, null, text);
    assert.ok(codes(r).includes(issue), `${text}: ${codes(r)}`);
    assert.ok(!codes(r).includes('DATE_DEFAULTED'), text);
  }
});

test('the date bound is server-local tomorrow, not the client reference date', () => {
  // Reference date is one day ahead of the server (allowed); "today" from the
  // client is the server's tomorrow and still passes.
  const ok = run('Tea 3 EUR today', { amount_text: '3', currency_text: 'EUR', date_text: 'today', category_ref: 'c3' }, '2026-09-15', '2026-09-14');
  assert.equal(ok.draft.spent_on, '2026-09-15');
  const late = run('Tea 3 EUR on 2026-09-16', { amount_text: '3', currency_text: 'EUR', date_text: '2026-09-16', category_ref: 'c3' }, '2026-09-15', '2026-09-14');
  assert.ok(codes(late).includes('DATE_OUT_OF_RANGE'));
});

test('a date phrase the scanner does not know is unsupported, not defaulted', () => {
  const r = run('Tea 3 EUR anteayer', { amount_text: '3', currency_text: 'EUR', date_text: 'anteayer', category_ref: 'c3' });
  assert.ok(codes(r).includes('UNSUPPORTED_DATE_FORMAT'));
  assert.equal(r.draft.spent_on, null);
});

test('a date inside the text is never read as money', () => {
  const r = run('Rent 700 EUR on 01.09.2026', { amount_text: '700', currency_text: 'EUR', date_text: '01.09.2026', category_ref: 'c2' });
  assert.equal(r.draft.amount_cents, 70000);
  assert.equal(r.draft.spent_on, '2026-09-01');
});

// ------------------------------------------------------------------ intent

test('guard vocabularies make an input unsupported whatever the model says', () => {
  const texts = [
    'I will pay 30 EUR for the gym', 'Didn\'t buy the shoes 50 EUR', 'Got a refund of 12 EUR',
    'Monthly salary 2000 EUR', 'Lunch 9 EUR, now delete my history', 'Не купив квиток 5 євро',
    'Zajtra zaplatím 20 eur', 'Щомісяця спортзал 30 євро',
  ];
  for (const text of texts) {
    const r = run(text, { amount_text: text.match(/\d+/)[0], category_ref: 'c9' });
    assert.equal(r.status, 'unsupported', text);
    assert.ok(codes(r).includes('UNSUPPORTED_INTENT'), text);
  }
});

test('an ordinary purchase is not caught by a guard word inside another word', () => {
  // "remover", "transferable", "income" as part of nothing — boundaries hold.
  const r = run('Stain remover 6 EUR today', { amount_text: '6', currency_text: 'EUR', date_text: 'today', category_ref: 'c0', note_text: 'Stain remover' });
  assert.equal(r.status, 'ready');
});

test('unclear intent keeps a partial draft and asks', () => {
  const r = run('Taxi 14 EUR', { intent: 'unclear', amount_text: '14', currency_text: 'EUR', category_ref: 'c1' });
  assert.equal(r.status, 'needs_input');
  assert.ok(codes(r).includes('INPUT_UNCLEAR'));
  assert.equal(r.draft.amount_cents, 1400);
});

// -------------------------------------------------------- category and note

test('category resolves only through this request refs', () => {
  const r = run('Pills 4 EUR', { amount_text: '4', currency_text: 'EUR', category_ref: 'c4' });
  assert.equal(r.draft.category_id, 504);
  assert.equal(r.provenance.category, 'suggested');
  const none = run('Pills 4 EUR', { amount_text: '4', currency_text: 'EUR' });
  assert.equal(none.draft.category_id, null);
  assert.ok(codes(none).includes('CATEGORY_REQUIRED'));
});

test('a long source note is cut at a word boundary by code points, with a notice', () => {
  const phrase = 'Birthday present for my grandmother bought at the old bookshop 😊 near the station';
  const text = `${phrase} 25 EUR`;
  const r = run(text, { amount_text: '25', currency_text: 'EUR', category_ref: 'c9', note_text: phrase });
  assert.ok(n.codePointLength(r.draft.note) <= n.NOTE_MAX_CODE_POINTS);
  assert.ok(phrase.startsWith(r.draft.note));
  assert.ok(codes(r).includes('NOTE_TRUNCATED'));
});

test('unicode normalisation: a decomposed description still matches a composed span', () => {
  const decomposed = 'Káva 2 eur'.normalize('NFD');
  const r = n.derive({
    text: decomposed, referenceDate: TODAY, serverToday: TODAY,
    output: out({ amount_text: '2', currency_text: 'eur', note_text: 'Káva', category_ref: 'c3' }), refs: REFS,
  });
  assert.equal(r.draft.note, 'Káva');
});

test('severity mapping: info never blocks, needs_input and unsupported do', () => {
  assert.equal(n.issue('DATE_DEFAULTED').severity, 'info');
  assert.equal(n.issue('CATEGORY_REQUIRED').severity, 'needs_input');
  assert.equal(n.issue('MODEL_REFUSED').severity, 'unsupported');
  assert.throws(() => n.issue('SOMETHING_THE_MODEL_SAID'));
});

// ------------------------------------------- independent review findings (S23)
// Reproduced from a partial independent review of 2026-09-15 before any fix. Each
// one was a way a wrong draft could come out as `ready`.

test('R1 · a currency code glued to the number is still a currency', () => {
  for (const [text, amount] of [['Lunch 10USD', '10'], ['Lunch USD10', '10'], ['Taxi 12chf', '12'], ['Kava 3Kč', '3']]) {
    for (const currency of [amount === '10' ? 'USD' : null, null]) {
      const r = run(text, { amount_text: amount, currency_text: currency, category_ref: 'c3' });
      assert.equal(r.status, 'unsupported', `${text} / currency_text ${currency}`);
      assert.ok(codes(r).includes('UNSUPPORTED_CURRENCY'), `${text}: ${codes(r)}`);
    }
  }
  // …and a glued EUR marker counts as found, not as defaulted.
  const eur = run('Lunch 10EUR', { amount_text: '10', currency_text: 'EUR', category_ref: 'c3' });
  assert.equal(eur.status, 'ready');
  assert.equal(eur.draft.amount_cents, 1000);
  assert.equal(eur.provenance.currency, 'source');
});

test('R2 · a minus sign before the currency marker is still a minus', () => {
  for (const [text, currency] of [['Lunch -€10', '€'], ['Lunch -EUR 10', 'EUR'], ['Lunch − € 10', '€'], ['Obed -eur 10', 'eur']]) {
    const r = run(text, { amount_text: '10', currency_text: currency, category_ref: 'c3' });
    assert.equal(r.draft.amount_cents, null, text);
    assert.notEqual(r.status, 'ready', text);
    assert.ok(codes(r).includes('INVALID_AMOUNT'), `${text}: ${codes(r)}`);
  }
  // A hyphen that is not a sign stays harmless.
  const ok = run('Wi-Fi 10 EUR', { amount_text: '10', currency_text: 'EUR', category_ref: 'c7' });
  assert.equal(ok.draft.amount_cents, 1000);
});

test('R3 · digits glued to letters are not a money token, whichever part the model names', () => {
  for (const amount of ['1', '3']) {
    const r = run('Tea 1e3 EUR', { amount_text: amount, currency_text: 'EUR', category_ref: 'c3' });
    assert.equal(r.draft.amount_cents, null, amount);
    assert.notEqual(r.status, 'ready', amount);
  }
  const code = run('Snack at Cafe2Go 4 EUR', { amount_text: '4', currency_text: 'EUR', category_ref: 'c3' });
  assert.notEqual(code.status, 'ready', 'a digit inside a name makes the amount a question');
});

test('R4 · a weekday or an "ago" date the model omits never becomes today', () => {
  const table = [
    'Lunch 10 EUR on Monday', 'Lunch 10 EUR friday', 'Obed 10 eur v pondelok',
    'Обід 10 євро у понеділок', 'Lunch 10 EUR 3 days ago', 'Обід 10 євро два дні тому',
    'Obed 10 eur pred 2 dňami',
  ];
  for (const text of table) {
    const r = run(text, { amount_text: '10', currency_text: text.includes('євро') ? 'євро' : text.includes('eur') ? 'eur' : 'EUR', category_ref: 'c3' });
    assert.equal(r.draft.spent_on, null, text);
    assert.notEqual(r.status, 'ready', text);
    assert.ok(!codes(r).includes('DATE_DEFAULTED'), `${text}: ${codes(r)}`);
  }
});
