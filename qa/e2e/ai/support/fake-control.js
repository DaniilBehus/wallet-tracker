'use strict';

// The browser specs run in the Playwright process; the fake OpenAI endpoint
// runs inside the web server process. They talk over its /__control routes.

const FAKE = () => process.env.QA_AI_FAKE_URL;

async function post(route, body) {
  const res = await fetch(`${FAKE()}/__control/${route}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status !== 204) throw new Error(`fake control ${route}: ${res.status}`);
}

const fake = {
  reset: () => post('reset'),
  plan: (step) => post('plan', step),
  openGate: (gate) => post('open-gate', { gate }),
  async state() {
    const res = await fetch(`${FAKE()}/__control/state`);
    return res.json();
  },
};

/** A provider answer in the contract's shape, with overrides. */
const answer = (fields) => ({
  output: {
    intent: 'expense', language: 'en', amount_text: null, currency_text: null,
    date_text: null, category_ref: null, note_text: null, ...fields,
  },
});

/** Every expense the user has, through the API. */
async function countExpenses(request, token) {
  const res = await request.get('/api/transactions?from=1900-01-01&to=2999-12-31&limit=200', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status() !== 200) throw new Error(`count: ${res.status()}`);
  return (await res.json()).total;
}

/** Local calendar dates, computed the way the page computes them. */
function localDay(offset = 0) {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
  const p = (n) => String(n).padStart(2, '0');
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}

function lastDayOfPreviousMonth() {
  const d = new Date();
  const s = new Date(d.getFullYear(), d.getMonth(), 0);
  const p = (n) => String(n).padStart(2, '0');
  return `${s.getFullYear()}-${p(s.getMonth() + 1)}-${p(s.getDate())}`;
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

module.exports = { fake, answer, countExpenses, localDay, lastDayOfPreviousMonth, MONTHS };
