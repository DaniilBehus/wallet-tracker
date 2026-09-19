'use strict';

// Deterministic derivation of an expense draft from a description and an
// untrusted provider answer (spec/ai-expense-entry.md §5–§6, D-034).
//
// Two sources are read independently and compared:
//
//   1. The provider's answer — which text it thinks is the amount, the date,
//      the currency, and which category ref fits. Treated as a claim.
//   2. This module's own scan of the description — money tokens, currency
//      markers, date expressions and a few guard vocabularies.
//
// Final values (cents, dates, IDs) are always computed here. When the two
// sources disagree the result becomes less certain (needs_input or
// unsupported), never more. A guard can only make a result safer.
//
// Pure module: no I/O, no clock. The caller passes the server's local today.

const { parseDate, daysInMonth, dayAfter } = require('../dates');

const NORMALIZER_VERSION = '2';   // 2: review findings R1–R4 (D-037)
const MAX_AMOUNT_CENTS = 100000000;          // 1 000 000 EUR, the domain maximum
const MIN_AI_DATE = '1900-01-01';            // AI entry range; see BUG-020
const NOTE_MAX_CODE_POINTS = 60;

// ------------------------------------------------------------------ helpers

const nfc = (value) => value.normalize('NFC');
const codePointLength = (value) => Array.from(value).length;
const pad2 = (n) => String(n).padStart(2, '0');
const pad4 = (n) => String(n).padStart(4, '0');

const escapeRegex = (word) => word.replace(/[.*+?^${}()|[\]\\]/g, (m) => '\\' + m);

/** Alternation of words, longest first, so a phrase wins over its suffix. */
const alternation = (list) =>
  [...list].sort((a, b) => b.length - a.length).map(escapeRegex).join('|');

/**
 * A regex matching whole words only. `\b` does not understand Cyrillic or
 * Slovak letters, so the boundary is written with Unicode property classes.
 */
const wordRegex = (list, flags = 'giu') =>
  new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation(list)})(?![\\p{L}\\p{N}])`, flags);

/**
 * A currency word may touch a digit: "10USD", "USD10", "3Kč". Only letters
 * end it. Using wordRegex here let "Lunch 10USD" pass as a euro expense (R1).
 */
const currencyRegex = (list, flags = 'giu') =>
  new RegExp(`(?<![\\p{L}])(?:${alternation(list)})(?![\\p{L}])`, flags);

// -------------------------------------------------------------- vocabularies
// Finite lists, stated as such in the case study. A word that is not here is
// not recognised; the result of not recognising it is always a less certain
// draft, never a more confident one.

const EUR_WORDS = ['eur', 'euro', 'euros', 'eura', 'eurá', 'євро'];
const EUR_SYMBOLS = ['€'];

const FOREIGN_WORDS = [
  'usd', 'dollar', 'dollars', 'dolár', 'doláre', 'dolárov', 'долар', 'долари', 'доларів',
  'gbp', 'pound', 'pounds', 'libra', 'libry', 'libier', 'фунт', 'фунти', 'фунтів',
  'czk', 'kč', 'koruna', 'koruny', 'korún', 'крона', 'крони', 'крон',
  'uah', 'грн', 'гривня', 'гривні', 'гривень', 'hryvnia', 'hryvnias',
  'chf', 'frank', 'franky', 'frankov', 'франк', 'франки', 'франків',
  'pln', 'zł', 'zloty', 'zlotých', 'злотий', 'злоті', 'злотих',
  'huf', 'ft', 'forint', 'forintov', 'форинт', 'форинти', 'форинтів',
];
const FOREIGN_SYMBOLS = ['$', '£', '₴'];

const FUTURE_WORDS = [
  'tomorrow', 'will', 'going to', 'next week', 'next month',
  'zajtra', 'kúpim', 'zaplatím', 'budem',
  'завтра', 'куплю', 'заплачу', 'буду',
];

const NEGATION_WORDS = [
  'did not', "didn't", 'didnt', 'never bought', 'not buy', 'not paid',
  'не купив', 'не купила', 'не купував', 'не витратив', 'не витратила', 'не платив', 'не заплатив',
  'nekúpil', 'nekúpila', 'nezaplatil', 'nezaplatila', 'neminul', 'neminula',
];

const NON_EXPENSE_WORDS = [
  'salary', 'wage', 'wages', 'paycheck', 'income', 'refund', 'refunded', 'reimbursement',
  'transfer', 'transferred', 'every month', 'each month', 'every week',
  'зарплата', 'зарплату', 'зарплати', 'дохід', 'повернення', 'повернули',
  'переказ', 'переказав', 'переказала', 'щомісяця', 'щотижня',
  'výplata', 'výplatu', 'príjem', 'vrátenie', 'vrátili', 'prevod', 'previedol', 'každý mesiac', 'každý týždeň',
];

const COMMAND_WORDS = [
  'delete', 'remove', 'erase', 'ignore all', 'ignore previous', 'disregard', 'system prompt', 'api key',
  'видали', 'видалити', 'вилучи', 'ігноруй',
  'vymaž', 'zmaž', 'ignoruj',
];

const APPROX_WORDS = [
  'about', 'approx', 'approximately', 'around', 'roughly', 'circa',
  'cca', 'okolo', 'zhruba', 'asi',
  'приблизно', 'близько', 'десь', 'майже',
];

const ARITHMETIC_WORDS = [
  'minus', 'plus', 'discount', 'tip', 'split', 'off',
  'zľava', 'zlava', 'sprepitné',
  'знижка', 'знижки', 'чайові', 'мінус', 'плюс',
];

const ALTERNATIVE_WORDS = ['or', 'to', 'або', 'чи', 'до', 'alebo', 'až'];

const RELATIVE_DAYS = [
  { words: ['day before yesterday', 'predvčerom', 'позавчора'], offset: -2 },
  { words: ['yesterday', 'včera', 'вчора', 'учора'], offset: -1 },
  { words: ['today', 'dnes', 'сьогодні'], offset: 0 },
];

const UNSUPPORTED_DATE_WORDS = [
  'last monday', 'last tuesday', 'last wednesday', 'last thursday', 'last friday',
  'last saturday', 'last sunday', 'last week', 'last month', 'last year',
  'minulý týždeň', 'minulý mesiac', 'minulý rok', 'minulý piatok', 'minulý pondelok',
  'минулого тижня', 'минулого місяця', 'минулого року', "минулої п'ятниці",
  "у п'ятницю", "в п'ятницю",
  // R4: a weekday alone is a date the scanner cannot resolve. Before, a model
  // that left it out got today's date by default.
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
  'pondelok', 'utorok', 'streda', 'stredu', 'štvrtok', 'piatok', 'sobota', 'sobotu', 'nedeľa', 'nedeľu',
  'понеділок', 'понеділка', 'вівторок', 'вівторка', 'середа', 'середу', 'четвер', 'четверга',
  "п'ятниця", "п'ятницю", "п’ятниця", "п’ятницю", "пʼятниця", "пʼятницю",
  'субота', 'суботу', 'неділя', 'неділю',
];

// R4: "3 days ago", "два дні тому", "pred 2 dňami" — relative dates v1 does not resolve.
const AGO_REGEX = new RegExp(
  [
    "(?<![\\p{L}\\p{N}])(?:\\d+|a|an|one|two|three|four|five|six|seven)\\s+(?:days?|weeks?|months?|years?)\\s+ago(?![\\p{L}])",
    "(?<![\\p{L}\\p{N}])(?:\\d+|один|одну|два|дві|три|чотири|п['’ʼ]ять)\\s+(?:день|дні|днів|тиждень|тижні|тижнів|місяць|місяці|місяців|рік|роки|років)\\s+тому(?![\\p{L}])",
    "(?<![\\p{L}])pred\\s+(?:\\d+|jedným|dvoma|dvomi|troma|tromi|štyrmi|piatimi)\\s+(?:dňom|dňami|dni|týždňom|týždňami|mesiacom|mesiacmi|rokom|rokmi)(?![\\p{L}])",
  ].join('|'),
  'giu'
);

const MONTH_NAMES = [
  'january', 'february', 'march', 'april', 'may', 'june', 'july',
  'august', 'september', 'october', 'november', 'december',
];

// ------------------------------------------------------------------- issues

const ISSUE_FIELD = {
  AMOUNT_REQUIRED: 'amount', INVALID_AMOUNT: 'amount', AMOUNT_OUT_OF_RANGE: 'amount',
  AMBIGUOUS_AMOUNT: 'amount', APPROXIMATE_AMOUNT: 'amount', NUMERIC_AMOUNT_REQUIRED: 'amount',
  DATE_REQUIRED: 'date', INVALID_DATE: 'date', AMBIGUOUS_DATE: 'date',
  UNSUPPORTED_DATE_FORMAT: 'date', DATE_OUT_OF_RANGE: 'date', DATE_DEFAULTED: 'date',
  CATEGORY_REQUIRED: 'category',
  CURRENCY_DEFAULTED: 'currency', UNSUPPORTED_CURRENCY: 'currency', AMBIGUOUS_CURRENCY: 'currency',
  NOTE_TRUNCATED: 'note',
  MULTIPLE_EXPENSES: 'input', UNSUPPORTED_INTENT: 'input', INPUT_UNCLEAR: 'input',
  MODEL_REFUSED: 'input', DEMO_UNSUPPORTED: 'input',
};

const INFO = new Set(['DATE_DEFAULTED', 'CURRENCY_DEFAULTED', 'NOTE_TRUNCATED']);
const UNSUPPORTED = new Set([
  'UNSUPPORTED_CURRENCY', 'MULTIPLE_EXPENSES', 'UNSUPPORTED_INTENT', 'MODEL_REFUSED', 'DEMO_UNSUPPORTED',
]);

function issue(code) {
  if (!ISSUE_FIELD[code]) throw new Error(`unknown issue code ${code}`);
  const severity = INFO.has(code) ? 'info' : UNSUPPORTED.has(code) ? 'unsupported' : 'needs_input';
  return { field: ISSUE_FIELD[code], code, severity };
}

/** Thrown when the provider's answer breaks the contract. Mapped to 502. */
class ContractViolation extends Error {
  constructor(reason) {
    super(reason);
    this.name = 'ContractViolation';
    this.reason = reason;
  }
}

// ------------------------------------------------------------ calendar math

/** The day before a valid 'YYYY-MM-DD'. Pure; no Date arithmetic. */
function dayBefore(value) {
  const d = parseDate(value);
  if (!d) throw new TypeError(`dayBefore: expected YYYY-MM-DD, got ${value}`);
  if (d.day > 1) return `${pad4(d.year)}-${pad2(d.month)}-${pad2(d.day - 1)}`;
  const year = d.month === 1 ? d.year - 1 : d.year;
  const month = d.month === 1 ? 12 : d.month - 1;
  return `${pad4(year)}-${pad2(month)}-${pad2(daysInMonth(year, month))}`;
}

function shiftBack(value, days) {
  let result = value;
  for (let i = 0; i < days; i++) result = dayBefore(result);
  return result;
}

// -------------------------------------------------------------- date scan

/**
 * Every date expression in the text, with its span and kind. Spans are masked
 * out of the text afterwards so that `31.08.2026` is never read as money.
 */
function scanDates(text) {
  const found = [];
  const taken = new Array(text.length).fill(false);

  const claim = (regex, kind, build) => {
    for (const m of text.matchAll(regex)) {
      const start = m.index + (m.groups && m.groups.lead ? m.groups.lead.length : 0);
      const matched = m.groups && m.groups.core !== undefined ? m.groups.core : m[0];
      const end = start + matched.length;
      if (taken.slice(start, end).some(Boolean)) continue;
      for (let i = start; i < end; i++) taken[i] = true;
      found.push({ start, end, text: matched, kind, ...build(m, matched) });
    }
  };

  claim(/(?<![\p{N}-])\d{4}-\d{2}-\d{2}(?![\p{N}-])/gu, 'iso', (m, t) => ({ value: t }));
  claim(/(?<![\p{N}.])\d{1,2}\.\d{1,2}\.\d{4}(?![\p{N}])/gu, 'dmy', (m, t) => ({ value: t }));
  claim(/(?<![\p{N}/])\d{1,2}\/\d{1,2}(?:\/\d{2,4})?(?![\p{N}/])/gu, 'ambiguous', () => ({}));
  claim(
    /(?<lead>(?<![\p{L}\p{N}])(?:on|dňa|dna|на)\s+)(?<core>\d{1,2}\.\d{1,2})\.?(?![\p{N}.])/giu,
    'unsupported',
    () => ({})
  );
  claim(
    new RegExp(`(?<![\\p{L}\\p{N}])\\d{1,2}\\s+(?:${MONTH_NAMES.join('|')})(?![\\p{L}])|(?<![\\p{L}])(?:${MONTH_NAMES.join('|')})\\s+\\d{1,2}(?![\\p{N}])`, 'giu'),
    'unsupported',
    () => ({})
  );
  claim(AGO_REGEX, 'unsupported', () => ({}));
  claim(wordRegex(UNSUPPORTED_DATE_WORDS), 'unsupported', () => ({}));
  for (const { words, offset } of RELATIVE_DAYS) {
    claim(wordRegex(words), 'relative', () => ({ offset }));
  }

  found.sort((a, b) => a.start - b.start);
  let masked = text;
  for (const d of found) {
    masked = masked.slice(0, d.start) + ' '.repeat(d.end - d.start) + masked.slice(d.end);
  }
  return { dates: found, masked };
}

// ------------------------------------------------------------- money scan

const GROUP_SPACE = '[ \\u00A0\\u202F]';
const TOKEN_REGEX = new RegExp(
  `(?<![\\p{N}.,])(?:\\d{1,3}(?:${GROUP_SPACE}\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)*)(?![\\p{N}])`,
  'gu'
);

const MARKER_AFTER = new RegExp(
  `^\\s*(?:${alternation([...EUR_SYMBOLS, ...FOREIGN_SYMBOLS])}|(?:${alternation([...EUR_WORDS, ...FOREIGN_WORDS])})(?![\\p{L}\\p{N}]))`,
  'iu'
);
const MARKER_BEFORE = new RegExp(
  `(?:${alternation([...EUR_SYMBOLS, ...FOREIGN_SYMBOLS])}|(?<![\\p{L}\\p{N}])(?:eur|usd|gbp|chf|pln|czk|uah|huf))\\s*$`,
  'iu'
);

const TRAILING_MARKER = new RegExp(
  `(?:${alternation([...EUR_SYMBOLS, ...FOREIGN_SYMBOLS])}|(?<![\\p{L}])(?:${alternation([...EUR_WORDS, ...FOREIGN_WORDS])}))$`,
  'iu'
);
const LEADING_CURRENCY_WORD = new RegExp(`^(?:${alternation([...EUR_WORDS, ...FOREIGN_WORDS])})(?![\\p{L}])`, 'iu');
const TRAILING_CURRENCY_WORD = new RegExp(`(?<![\\p{L}])(?:${alternation([...EUR_WORDS, ...FOREIGN_WORDS])})$`, 'iu');

function scanTokens(masked) {
  const tokens = [];
  for (const m of masked.matchAll(TOKEN_REGEX)) {
    const start = m.index;
    const end = start + m[0].length;
    const before = masked.slice(Math.max(0, start - 12), start);
    const after = masked.slice(end, end + 16);

    // R2: the sign may sit before the currency marker: "-€10", "-EUR 10".
    let prefix = masked.slice(0, start).replace(/\s+$/, '');
    prefix = prefix.replace(TRAILING_MARKER, '').replace(/\s+$/, '');
    const signChar = prefix.slice(-1);
    const beforeSign = prefix.slice(-2, -1);

    // R3: digits touching letters ("1e3", "Cafe2Go", "3x") are not a clean
    // amount, unless the letters are a currency word ("10USD", "EUR10").
    const letterBefore = /\p{L}/u.test(masked.charAt(start - 1));
    const letterAfter = /\p{L}/u.test(masked.charAt(end));
    const wordBefore = masked.slice(0, start).match(/\p{L}+$/u);
    const wordAfter = masked.slice(end).match(/^\p{L}+/u);
    const glued =
      (letterBefore && !(wordBefore && TRAILING_CURRENCY_WORD.test(wordBefore[0]))) ||
      (letterAfter && !(wordAfter && LEADING_CURRENCY_WORD.test(wordAfter[0])));

    tokens.push({
      start,
      end,
      text: m[0],
      marked: MARKER_AFTER.test(after) || MARKER_BEFORE.test(before),
      negative: (signChar === '-' || signChar === '−') && !/\p{N}/u.test(beforeSign),
      glued,
    });
  }
  return tokens;
}

/** Exact money parsing of one token. Returns { cents } or { issue }. */
function parseMoneyToken(tokenText) {
  const text = tokenText.replace(/[  ]/g, ' ');

  const grouped = text.match(/^(\d{1,3}(?: \d{3})+)(?:[.,](\d+))?$/);
  let whole;
  let fraction = '';
  if (grouped) {
    whole = grouped[1].replace(/ /g, '');
    fraction = grouped[2] || '';
  } else {
    if (!/^\d+(?:[.,]\d+)*$/.test(text)) return { issue: 'INVALID_AMOUNT' };
    const separators = text.match(/[.,]/g) || [];
    if (separators.includes('.') && separators.includes(',')) return { issue: 'AMBIGUOUS_AMOUNT' };
    if (separators.length > 1) return { issue: 'AMBIGUOUS_AMOUNT' };
    if (separators.length === 1) {
      const [w, f] = text.split(/[.,]/);
      // Exactly three digits after a single separator is a thousands group or
      // three decimals; both readings are real, so neither is chosen.
      if (f.length === 3) return { issue: 'AMBIGUOUS_AMOUNT' };
      whole = w;
      fraction = f;
    } else {
      whole = text;
    }
  }

  if (fraction.length > 2) return { issue: 'AMBIGUOUS_AMOUNT' };
  whole = whole.replace(/^0+(?=\d)/, '');
  // More than seven whole digits is above 9 999 999 EUR, already out of range;
  // stopping here also keeps the digit string short enough to be exact.
  if (whole.length > 7) return { issue: 'AMOUNT_OUT_OF_RANGE' };

  // Digit-string conversion: "12" + "50" -> "1250". No float ever holds money.
  const cents = Number(whole + (fraction + '00').slice(0, 2));
  if (!Number.isSafeInteger(cents)) return { issue: 'INVALID_AMOUNT' };
  if (cents <= 0) return { issue: 'INVALID_AMOUNT' };
  if (cents > MAX_AMOUNT_CENTS) return { issue: 'AMOUNT_OUT_OF_RANGE' };
  return { cents };
}

// ---------------------------------------------------------- literal checks

const isLiteral = (source, fragment) => source.includes(nfc(fragment));

function stripMarkers(value) {
  const edge = new RegExp(
    `^(?:\\s|${alternation([...EUR_SYMBOLS, ...FOREIGN_SYMBOLS])}|(?:${alternation([...EUR_WORDS, ...FOREIGN_WORDS])})(?![\\p{L}]))+|(?:\\s|${alternation([...EUR_SYMBOLS, ...FOREIGN_SYMBOLS])}|(?<![\\p{L}])(?:${alternation([...EUR_WORDS, ...FOREIGN_WORDS])}))+$`,
    'giu'
  );
  return value.replace(edge, '');
}

function classifyCurrency(value) {
  const v = value.trim().toLowerCase();
  if (EUR_SYMBOLS.includes(v) || EUR_WORDS.includes(v)) return 'eur';
  if (FOREIGN_SYMBOLS.includes(v) || FOREIGN_WORDS.includes(v)) return 'foreign';
  return 'unknown';
}

function truncateNote(note) {
  if (codePointLength(note) <= NOTE_MAX_CODE_POINTS) return { note, truncated: false };
  const points = Array.from(note).slice(0, NOTE_MAX_CODE_POINTS);
  const joined = points.join('');
  const lastSpace = joined.lastIndexOf(' ');
  const cut = lastSpace > 20 ? joined.slice(0, lastSpace) : joined;
  return { note: cut.trim(), truncated: true };
}

// ------------------------------------------------------------- derivation

/**
 * @param {object} input
 * @param {string} input.text            the description, already validated
 * @param {string} input.referenceDate   validated YYYY-MM-DD
 * @param {string} input.serverToday     server-local today, YYYY-MM-DD
 * @param {object} input.output          provider output, shape already validated
 * @param {Map<string, number>} input.refs   category ref -> owned id
 * @returns {{status, draft, provenance, issues}}
 * @throws {ContractViolation} when a text span or ref breaks the contract
 */
function derive({ text, referenceDate, serverToday, output, refs }) {
  const source = nfc(text);

  // ---- contract: literal spans and refs, before anything else. An invented
  // span is an upstream failure even when the input will be unsupported.
  for (const key of ['amount_text', 'currency_text', 'date_text', 'note_text']) {
    const value = output[key];
    if (value !== null && !isLiteral(source, value)) {
      throw new ContractViolation(`${key} is not text from the description`);
    }
  }
  if (output.category_ref !== null && !refs.has(output.category_ref)) {
    throw new ContractViolation('category_ref was not offered in this request');
  }

  const { dates, masked } = scanDates(source);
  const tokens = scanTokens(masked);

  let modelToken = null;
  if (output.amount_text !== null) {
    const stripped = stripMarkers(nfc(output.amount_text));
    modelToken = tokens.find((t) => t.text === stripped) || null;
    if (!modelToken) {
      // "18" inside "180" is literal text but not a whole number of the input.
      throw new ContractViolation('amount_text is not one whole number from the description');
    }
  }

  const issues = [];
  const add = (code) => {
    if (!issues.some((i) => i.code === code)) issues.push(issue(code));
  };

  // ---- guards that make the whole input unsupported
  const foreign = FOREIGN_SYMBOLS.some((s) => source.includes(s)) || currencyRegex(FOREIGN_WORDS, 'iu').test(source);
  const markedTokens = tokens.filter((t) => t.marked);

  if (foreign) add('UNSUPPORTED_CURRENCY');
  if (output.intent === 'multiple_expenses' || markedTokens.length >= 2) add('MULTIPLE_EXPENSES');
  if (output.intent === 'non_expense') add('UNSUPPORTED_INTENT');
  for (const list of [FUTURE_WORDS, NEGATION_WORDS, NON_EXPENSE_WORDS, COMMAND_WORDS]) {
    if (wordRegex(list, 'iu').test(source)) add('UNSUPPORTED_INTENT');
  }

  const empty = { amount_cents: null, category_id: null, spent_on: null, note: null };
  const noneProvenance = { amount: 'none', category: 'none', date: 'none', currency: 'none', note: 'none' };

  if (issues.some((i) => i.severity === 'unsupported')) {
    return { status: 'unsupported', draft: empty, provenance: noneProvenance, issues };
  }

  if (output.intent === 'unclear') add('INPUT_UNCLEAR');

  const draft = { ...empty };
  const provenance = { ...noneProvenance };

  // ---- amount
  const eurPresent = EUR_SYMBOLS.some((s) => source.includes(s)) || currencyRegex(EUR_WORDS, 'iu').test(source);
  const approximate =
    new RegExp(`(?<![\\p{L}\\p{N}])(?:${alternation(APPROX_WORDS)})\\s*(?:€|\\$)?\\s*\\d`, 'iu').test(masked) ||
    /~\s*\d/u.test(masked);
  const alternatives =
    new RegExp(`\\d(?:[.,]\\d+)?\\s*(?:[-–—]|(?:${alternation(ALTERNATIVE_WORDS)})(?![\\p{L}]))\\s*\\d`, 'iu').test(masked);
  const arithmetic = tokens.length > 0 && (wordRegex(ARITHMETIC_WORDS, 'iu').test(masked) || /\d\s*\+\s*\d/u.test(masked));

  let selected = null;
  let amountIssue = null;
  if (approximate) amountIssue = 'APPROXIMATE_AMOUNT';
  else if (alternatives || arithmetic) amountIssue = 'AMBIGUOUS_AMOUNT';
  else if (tokens.some((t) => t.glued)) amountIssue = 'AMBIGUOUS_AMOUNT';
  else if (markedTokens.length === 1) selected = markedTokens[0];
  else if (tokens.length === 1) selected = tokens[0];
  else if (tokens.length > 1) amountIssue = 'AMBIGUOUS_AMOUNT';
  else amountIssue = eurPresent ? 'NUMERIC_AMOUNT_REQUIRED' : 'AMOUNT_REQUIRED';

  if (selected) {
    // Neither side is trusted over the other: a disagreement is a question.
    if (!modelToken || modelToken.text !== selected.text) amountIssue = 'AMBIGUOUS_AMOUNT';
    else if (selected.negative) amountIssue = 'INVALID_AMOUNT';
    else {
      const parsed = parseMoneyToken(selected.text);
      if (parsed.issue) amountIssue = parsed.issue;
      else {
        draft.amount_cents = parsed.cents;
        provenance.amount = 'source';
      }
    }
  }
  if (amountIssue) add(amountIssue);

  // ---- currency
  if (output.currency_text !== null && classifyCurrency(output.currency_text) === 'unknown') {
    add('AMBIGUOUS_CURRENCY');
  } else if (eurPresent) {
    provenance.currency = 'source';
  } else {
    provenance.currency = 'default';
    add('CURRENCY_DEFAULTED');
  }

  // ---- date
  const tomorrow = dayAfter(serverToday);
  let dateIssue = null;
  let spentOn = null;
  let dateProvenance = 'none';

  if (dates.length === 0) {
    if (output.date_text === null) {
      spentOn = referenceDate;
      dateProvenance = 'default';
    } else {
      dateIssue = 'UNSUPPORTED_DATE_FORMAT';
    }
  } else if (dates.length > 1) {
    dateIssue = 'AMBIGUOUS_DATE';
  } else {
    const expr = dates[0];
    const model = output.date_text === null ? null : nfc(output.date_text).trim().toLowerCase();
    const scanned = expr.text.toLowerCase();
    if (model === null || !(model.includes(scanned) || scanned.includes(model))) {
      dateIssue = 'AMBIGUOUS_DATE';
    } else if (expr.kind === 'ambiguous') {
      dateIssue = 'AMBIGUOUS_DATE';
    } else if (expr.kind === 'unsupported') {
      dateIssue = 'UNSUPPORTED_DATE_FORMAT';
    } else if (expr.kind === 'relative') {
      spentOn = shiftBack(referenceDate, -expr.offset);
      dateProvenance = 'source';
    } else {
      const iso = expr.kind === 'iso'
        ? expr.value
        : (() => {
            const [d, m, y] = expr.value.split('.').map(Number);
            return `${pad4(y)}-${pad2(m)}-${pad2(d)}`;
          })();
      if (!parseDate(iso)) dateIssue = 'INVALID_DATE';
      else {
        spentOn = iso;
        dateProvenance = 'source';
      }
    }
  }

  if (spentOn !== null && (spentOn < MIN_AI_DATE || spentOn > tomorrow)) {
    spentOn = null;
    dateProvenance = 'none';
    dateIssue = 'DATE_OUT_OF_RANGE';
  }
  if (dateIssue) add(dateIssue);
  if (dateProvenance === 'default') add('DATE_DEFAULTED');
  draft.spent_on = spentOn;
  provenance.date = dateProvenance;

  // ---- category
  if (output.category_ref === null) add('CATEGORY_REQUIRED');
  else {
    draft.category_id = refs.get(output.category_ref);
    provenance.category = 'suggested';
  }

  // ---- note
  if (output.note_text !== null) {
    const trimmed = nfc(output.note_text).trim();
    if (trimmed !== '') {
      const { note, truncated } = truncateNote(trimmed);
      draft.note = note;
      provenance.note = 'source';
      if (truncated) add('NOTE_TRUNCATED');
    }
  }

  const status = issues.some((i) => i.severity === 'needs_input') ? 'needs_input' : 'ready';
  return { status, draft, provenance, issues };
}

/** A refused or demo-unsupported answer, with nothing filled in. */
function unsupportedResult(code) {
  return {
    status: 'unsupported',
    draft: { amount_cents: null, category_id: null, spent_on: null, note: null },
    provenance: { amount: 'none', category: 'none', date: 'none', currency: 'none', note: 'none' },
    issues: [issue(code)],
  };
}

module.exports = {
  NORMALIZER_VERSION,
  MAX_AMOUNT_CENTS,
  MIN_AI_DATE,
  NOTE_MAX_CODE_POINTS,
  ContractViolation,
  derive,
  unsupportedResult,
  parseMoneyToken,
  scanDates,
  scanTokens,
  dayBefore,
  codePointLength,
  nfc,
  issue,
};
