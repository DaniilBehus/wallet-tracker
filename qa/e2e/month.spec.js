'use strict';

const { test, expect, eur, eurPattern, eurWithin } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { MonthPage } = require('./pages/month.page');
const { contrastRatio, parseRgb } = require('./support/contrast');

/**
 * Screen 6.2. State is arranged through the API: a test about the month view
 * should fail when the month view is broken, not when the keypad is.
 */

test.describe('This month', () => {
  test('the total, the bars and the list agree with what was spent', testCase('TC-E2E-012'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries, transport] = await api.categories();

    const first = await api.addExpense({ amount_cents: 2500, category_id: groceries.id });
    const second = await api.addExpense({ amount_cents: 750, category_id: transport.id });

    await month.goToMonth();

    await expect(month.total).toHaveText(eurPattern(3250));
    await expect(month.rows).toHaveCount(2);
    await expect(month.row(first.id)).toBeVisible();
    await expect(month.row(second.id)).toBeVisible();

    await expect(month.bar(groceries.id)).toBeVisible();
    await expect(month.bar(transport.id)).toBeVisible();
    await expect(month.bars).toHaveCount(2);
  });

  test('a category bar is labelled with its share of the month', testCase('TC-E2E-013'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries, transport] = await api.categories();

    await api.addExpense({ amount_cents: 7500, category_id: groceries.id });
    await api.addExpense({ amount_cents: 2500, category_id: transport.id });

    await month.goToMonth();

    // 75 % and 25 % of 100,00 €. The label is the accessible name of the bar,
    // so this checks the number a screen reader would announce.
    await expect(month.bar(groceries.id)).toHaveAttribute('aria-label', /75%/);
    await expect(month.bar(transport.id)).toHaveAttribute('aria-label', /25%/);
  });

  test('deleting an expense removes the row and lowers the total', testCase('TC-E2E-014'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();

    const kept = await api.addExpense({ amount_cents: 1000, category_id: groceries.id });
    const doomed = await api.addExpense({ amount_cents: 2500, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.total).toHaveText(eurPattern(3500));

    await month.deleteButton(doomed.id).click();

    await expect(month.toastSuccess).toHaveText('Expense deleted');
    await expect(month.row(doomed.id)).toHaveCount(0);
    await expect(month.row(kept.id)).toBeVisible();
    await expect(month.total).toHaveText(eurPattern(1000));
  });

  test('a month with nothing in it shows zero, not a broken screen', testCase('TC-E2E-015'), async ({ signedIn }) => {
    const month = new MonthPage(signedIn);

    await month.goToMonth();

    await expect(month.total).toHaveText(eurPattern(0));
    await expect(month.rows).toHaveCount(0);
    await expect(month.bars).toHaveCount(0);
  });

  test('one user never sees another user\'s expenses', testCase('TC-E2E-016'), async ({ signedIn, api, request }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpense({ amount_cents: 1234, category_id: groceries.id });

    // A second, unrelated account created inline — this test owns both.
    const stamp = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
    const other = await request.post('/api/auth/register', {
      data: { email: `other-${stamp}@wallet.test`, password: `other-passphrase-${stamp}` },
    });
    const { token } = await other.json();

    await month.page.addInitScript((t) => {
      window.localStorage.setItem('wallet_token', t);
    }, token);
    await month.page.reload();
    await month.goToMonth();

    await expect(month.total).toHaveText(eurPattern(0));
    await expect(month.rows).toHaveCount(0);
  });
});
/**
 * The monthly spending limit. Requirements, decision table, boundaries and the
 * traceability matrix: qa/docs/analysis-monthly-limit.md. These five cases are
 * the screen half of that matrix; the decision table itself is exercised
 * against the API in collection folder 12.
 */
test.describe('Monthly spending limit', () => {
  test('the screen states the limit and how much of it is left', testCase('TC-E2E-065'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 20000 });
    await api.addExpense({ amount_cents: 5000, category_id: groceries.id });

    await month.goToMonth();

    await expect(month.limit).toHaveText(eurPattern(20000));
    await expect(month.limitStatus).toContainText('Within limit');
    await expect(month.limitStatus).toContainText(eurWithin(15000));
  });

  test('over the limit is said in words and marked, not only coloured', testCase('TC-E2E-066'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 10000 });
    await api.addExpense({ amount_cents: 12500, category_id: groceries.id });

    await month.goToMonth();

    await expect(month.limitStatus).toContainText('Over limit');
    await expect(month.limitStatus).toContainText(eurWithin(2500));
    // The class carries the same fact for anyone styling it; the words above
    // are what a person reads (REQ-ML-09, RISK-ML-6).
    await expect(month.limitStatus).toHaveClass(/figure--over/);
  });

  test('setting a limit on the screen updates the state without a reload', testCase('TC-E2E-067'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.addExpense({ amount_cents: 5000, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.limit).toHaveText('Set limit');

    await month.setLimit('60.00');

    await expect(month.limit).toHaveText(eurPattern(6000));
    await expect(month.limitStatus).toContainText('Within limit');
    await expect(month.limitStatus).toContainText(eurWithin(1000));
    expect((await api.settings()).monthly_limit_cents).toBe(6000);
  });

  test('clearing the field removes the limit and the state line', testCase('TC-E2E-068'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 20000 });

    await month.goToMonth();
    await expect(month.limit).toHaveText(eurPattern(20000));

    await month.setLimit('');

    await expect(month.limit).toHaveText('Set limit');
    await expect(month.limitStatus).toBeHidden();
    expect((await api.settings()).monthly_limit_cents).toBeNull();
  });

  test('a figure that is not a number is refused and changes nothing', testCase('TC-E2E-069'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 20000 });

    await month.goToMonth();
    await month.setLimit('not a number');

    await expect(month.toastError).toBeVisible();
    await expect(month.limit).toHaveText(eurPattern(20000));
    expect((await api.settings()).monthly_limit_cents).toBe(20000);
  });
});

/** '#a7c0ba' or 'rgb(…)' → 'rgb(r, g, b)', so a token and a computed colour compare. */
function asRgb(value) {
  const v = String(value).trim();
  if (!v.startsWith('#')) return v;
  const byte = (i) => parseInt(v.slice(i, i + 2), 16);
  return `rgb(${byte(1)}, ${byte(3)}, ${byte(5)})`;
}

/**
 * What the frame looks like right now, and what the palette says it should be.
 * The border is read as the browser resolved it — the appearance, not the class.
 */
function readFrame(month) {
  return month.limitFigure.evaluate((el) => {
    const root = getComputedStyle(document.documentElement);
    return {
      color: getComputedStyle(el).borderTopColor,
      neutral: root.getPropertyValue('--limit-frame'),
      over: root.getPropertyValue('--limit-frame-over'),
    };
  });
}

/**
 * The frame against what it is drawn on (WCAG 1.4.11 asks 3:1 of a graphical
 * object). The month header is painted with a gradient, so its
 * backgroundColor is transparent and the walk-up in the BUG-001 check would
 * land on the page behind it. The stops are read off background-image instead,
 * and the frame must clear 3:1 against every one — the ends of the gradient are
 * its darkest and lightest points here, because every channel of both palettes'
 * header gradients moves toward the same end.
 */
async function expectFrameContrast(month, color) {
  const image = await month.head.evaluate((el) => getComputedStyle(el).backgroundImage);
  const stops = image.match(/rgba?\([^)]*\)/g) || [];
  expect(stops.length, `the month header should be a gradient, got: ${image}`).toBeGreaterThanOrEqual(2);
  for (const stop of stops) {
    const ratio = contrastRatio(color, stop);
    expect(ratio, `frame ${color} on ${stop} is ${ratio.toFixed(2)}:1, below 3:1`).toBeGreaterThanOrEqual(3);
  }
}

/**
 * UAT-OBS-01: the owner asked for a frame around the limit figure — red when
 * the limit is used up, neutral while budget remains, none with no limit. The
 * sentence under the figures still carries the state in words; these cases
 * are about the frame, and the words are checked alongside where the frame
 * deliberately says less than they do.
 */
test.describe('The limit frame (UAT-OBS-01)', () => {
  test('no limit, no frame', testCase('TC-E2E-076'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: null });

    await month.goToMonth();
    await expect(month.limit).toHaveText('Set limit');

    const { color } = await readFrame(month);
    // The border is always there and only changes colour, so "no frame" is a
    // border nobody can see: fully transparent.
    expect(parseRgb(color).a, `the frame should be invisible, got ${color}`).toBe(0);
  });

  test('budget left: a neutral frame', testCase('TC-E2E-077'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 20000 });
    await api.addExpense({ amount_cents: 5000, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.limitStatus).toContainText('Within limit');

    const frame = await readFrame(month);
    expect(frame.color).toBe(asRgb(frame.neutral));
    expect(asRgb(frame.neutral), 'neutral and red must not be the same colour').not.toBe(asRgb(frame.over));
    await expectFrameContrast(month, frame.color);
  });

  test('exactly at the limit: the red frame, while the words still say reached', testCase('TC-E2E-078'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 10000 });
    await api.addExpense({ amount_cents: 10000, category_id: groceries.id });

    await month.goToMonth();

    // Nothing is left, so the frame is red — but equality is "reached", not
    // "over" (REQ-ML-05 R5), and the words and their class keep saying so.
    await expect(month.limitStatus).toHaveText('Limit reached');
    await expect(month.limitStatus).not.toHaveClass(/figure--over/);
    const frame = await readFrame(month);
    expect(frame.color).toBe(asRgb(frame.over));
  });

  test('over the limit: the red frame, readable on the header', testCase('TC-E2E-079'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 10000 });
    await api.addExpense({ amount_cents: 12500, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.limitStatus).toContainText('Over limit');

    const frame = await readFrame(month);
    expect(frame.color).toBe(asRgb(frame.over));
    await expectFrameContrast(month, frame.color);
  });

  test('the light palette clears 3:1 too', testCase('TC-E2E-080'), async ({ signedIn, api }) => {
    // theme.css is the shipped dark palette; style.css carries a light one of
    // its own underneath. Withholding theme.css is how that palette renders.
    const month = new MonthPage(signedIn);
    const gradient = () => month.head.evaluate((el) => getComputedStyle(el).backgroundImage);
    const shipped = await gradient();
    await signedIn.route('**/theme.css', (route) => route.abort());
    await signedIn.reload();
    // Without this the case could measure the shipped palette twice and pass.
    expect(await gradient(), 'theme.css was not withheld').not.toBe(shipped);

    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 20000 });
    await api.addExpense({ amount_cents: 5000, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.limitStatus).toContainText('Within limit');
    const neutral = await readFrame(month);
    expect(neutral.color).toBe(asRgb(neutral.neutral));
    await expectFrameContrast(month, neutral.color);

    // Push the month over the limit and let the screen redraw.
    await api.addExpense({ amount_cents: 20000, category_id: groceries.id });
    await signedIn.reload();
    await month.goToMonth();
    await expect(month.limitStatus).toContainText('Over limit');
    const over = await readFrame(month);
    expect(over.color).toBe(asRgb(over.over));
    await expectFrameContrast(month, over.color);
  });
});
