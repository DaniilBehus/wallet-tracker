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

  test('at 320 px the largest amount stays whole and clear of the name', testCase('TC-E2E-081'), async ({ signedIn, api }) => {
    // Nothing may overflow on a 320 px screen (the layout contract in
    // style.css), and the widest thing a row can hold is the amount ceiling.
    await signedIn.setViewportSize({ width: 320, height: 568 });
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    const tx = await api.addExpense({ amount_cents: 100000000, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.txAmount(tx.id)).toHaveText(eur(100000000));

    // The painted text, not the element boxes: a name running past its own
    // box leaves the boxes apart and still draws over the amount.
    const inked = (locator) => locator.evaluate((node) => {
      const range = document.createRange();
      range.selectNodeContents(node);
      const { left, right, top, bottom } = range.getBoundingClientRect();
      return { left, right, top, bottom };
    });
    const name = await inked(month.txName(tx.id));
    const amount = await inked(month.txAmount(tx.id));
    const apart = name.right <= amount.left || amount.right <= name.left ||
      name.bottom <= amount.top || amount.bottom <= name.top;
    expect(apart, `name ${JSON.stringify(name)} overlaps amount ${JSON.stringify(amount)}`).toBe(true);

    // Whole: no part of the amount is clipped, and it stays inside its row.
    const fit = await month.txAmount(tx.id).evaluate((node) => ({ scroll: node.scrollWidth, client: node.clientWidth }));
    expect(fit.scroll, 'the amount is clipped').toBeLessThanOrEqual(fit.client);
    const row = await month.row(tx.id).boundingBox();
    expect(amount.left).toBeGreaterThanOrEqual(row.x);
    expect(amount.right).toBeLessThanOrEqual(row.x + row.width);
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

/** '#b73b32' or 'rgb(…)' → 'rgb(r, g, b)', so a token and a computed colour compare. */
function asRgb(value) {
  const v = String(value).trim();
  if (!v.startsWith('#')) return v;
  const byte = (i) => parseInt(v.slice(i, i + 2), 16);
  return `rgb(${byte(1)}, ${byte(3)}, ${byte(5)})`;
}

const WHITE = 'rgb(255, 255, 255)';

/**
 * What the status box looks like right now, and what the palette says it
 * should be. The box is read as the browser resolved it — the appearance, not
 * the class.
 */
function readBox(month) {
  return month.limitStatus.evaluate((el) => {
    const style = getComputedStyle(el);
    const root = getComputedStyle(document.documentElement);
    return {
      fill: style.backgroundColor,
      border: style.borderTopColor,
      borderWidth: parseFloat(style.borderTopWidth),
      text: style.color,
      weight: Number(style.fontWeight),
      usedUp: root.getPropertyValue('--limit-used-up'),
      outline: root.getPropertyValue('--limit-outline'),
    };
  });
}

/**
 * The outline against what it is drawn on (WCAG 1.4.11 asks 3:1 of a
 * graphical object). The month header is painted with a gradient, so its
 * backgroundColor is transparent and the walk-up in the BUG-001 check would
 * land on the page behind it. The stops are read off background-image instead,
 * and the outline must clear 3:1 against every one — the ends of the gradient
 * are its darkest and lightest points here, because every channel of both
 * palettes' header gradients moves toward the same end.
 */
async function expectOutlineContrast(month, color) {
  const image = await month.head.evaluate((el) => getComputedStyle(el).backgroundImage);
  const stops = image.match(/rgba?\([^)]*\)/g) || [];
  expect(stops.length, `the month header should be a gradient, got: ${image}`).toBeGreaterThanOrEqual(2);
  for (const stop of stops) {
    const ratio = contrastRatio(color, stop);
    expect(ratio, `outline ${color} on ${stop} is ${ratio.toFixed(2)}:1, below 3:1`).toBeGreaterThanOrEqual(3);
  }
}

/** The text on the red fill: normal-size text, so WCAG 1.4.3 asks 4.5:1. */
function expectTextContrast(box) {
  const ratio = contrastRatio(box.text, box.fill);
  expect(ratio, `text ${box.text} on ${box.fill} is ${ratio.toFixed(2)}:1, below 4.5:1`).toBeGreaterThanOrEqual(4.5);
}

/**
 * UAT-OBS-01, rev 2. The owner rejected a frame around the limit figure and
 * asked for the status line itself to carry the state: a solid red box with
 * white text once the limit is used up, a white outline while budget remains,
 * nothing without a limit. These cases read the box as the browser drew it;
 * the words are checked alongside where the box deliberately says less than
 * they do.
 */
test.describe('The limit status box (UAT-OBS-01)', () => {
  test('no limit, no box', testCase('TC-E2E-076'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: null });

    await month.goToMonth();
    await expect(month.limit).toHaveText('Set limit');

    await expect(month.limitStatus).toBeHidden();
    await expect(month.limitStatus).not.toHaveClass(/limit-status--/);
  });

  test('budget left: a white outline and no fill', testCase('TC-E2E-077'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 20000 });
    await api.addExpense({ amount_cents: 5000, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.limitStatus).toContainText('Within limit');

    const box = await readBox(month);
    expect(parseRgb(box.fill).a, `budget left must not be filled, got ${box.fill}`).toBe(0);
    expect(box.borderWidth, 'the outline is missing').toBeGreaterThanOrEqual(1);
    expect(box.border).toBe(asRgb(box.outline));
    expect(asRgb(box.outline), 'the outline and the red must not be the same colour').not.toBe(asRgb(box.usedUp));
    await expectOutlineContrast(month, box.border);
  });

  test('exactly at the limit: the red box, while the words still say reached', testCase('TC-E2E-078'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 10000 });
    await api.addExpense({ amount_cents: 10000, category_id: groceries.id });

    await month.goToMonth();

    // Nothing is left, so the box is red — but equality is "reached", not
    // "over" (REQ-ML-05 R5), and the words and their class keep saying so.
    await expect(month.limitStatus).toHaveText('Limit reached');
    await expect(month.limitStatus).not.toHaveClass(/figure--over/);
    const box = await readBox(month);
    expect(box.fill).toBe(asRgb(box.usedUp));
    expect(box.text).toBe(WHITE);
  });

  test('over the limit: white bold text on solid red, at 4.5:1', testCase('TC-E2E-079'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 10000 });
    await api.addExpense({ amount_cents: 12500, category_id: groceries.id });

    await month.goToMonth();
    await expect(month.limitStatus).toContainText('Over limit');
    await expect(month.limitStatus).toHaveClass(/figure--over/);

    const box = await readBox(month);
    expect(box.fill).toBe(asRgb(box.usedUp));
    expect(parseRgb(box.fill).a, 'the red must be solid').toBe(1);
    expect(box.text).toBe(WHITE);
    expect(box.weight, 'the text must be bold').toBeGreaterThanOrEqual(700);
    expectTextContrast(box);
  });

  test('the light palette clears both thresholds too', testCase('TC-E2E-080'), async ({ signedIn, api }) => {
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
    const within = await readBox(month);
    expect(parseRgb(within.fill).a).toBe(0);
    expect(within.border).toBe(asRgb(within.outline));
    await expectOutlineContrast(month, within.border);

    // Push the month over the limit and let the screen redraw.
    await api.addExpense({ amount_cents: 20000, category_id: groceries.id });
    await signedIn.reload();
    await month.goToMonth();
    await expect(month.limitStatus).toContainText('Over limit');
    const over = await readBox(month);
    expect(over.fill).toBe(asRgb(over.usedUp));
    expect(over.text).toBe(WHITE);
    expectTextContrast(over);
  });

  test('the limit figure is never framed, and the figures above do not move', testCase('TC-E2E-084'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();

    const figures = async () => {
      const frame = await month.limitFigure.evaluate((el) => {
        const style = getComputedStyle(el);
        return ['Top', 'Right', 'Bottom', 'Left'].map((side) => parseFloat(style[`border${side}Width`]));
      });
      const at = async (locator) => {
        const { x, y } = await locator.boundingBox();
        return [Math.round(x), Math.round(y)];
      };
      return { frame, places: [await at(month.income), await at(month.remaining), await at(month.limit)] };
    };
    const showState = async (words) => {
      await signedIn.reload();
      await month.goToMonth();
      await expect(month.limitStatus).toContainText(words);
    };

    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: null });
    await month.goToMonth();
    await expect(month.limit).toHaveText('Set limit');
    const first = await figures();
    expect(first.frame, 'the limit figure has a frame with no limit set').toEqual([0, 0, 0, 0]);

    // Within, then exactly at, then over the limit: one account, one step each.
    await api.setSettings({ monthly_income_cents: 150000, monthly_limit_cents: 20000 });
    await api.addExpense({ amount_cents: 5000, category_id: groceries.id });
    await showState('Within limit');
    const within = await figures();

    await api.addExpense({ amount_cents: 15000, category_id: groceries.id });
    await showState('Limit reached');
    const reached = await figures();

    await api.addExpense({ amount_cents: 5000, category_id: groceries.id });
    await showState('Over limit');
    const over = await figures();

    for (const [state, seen] of Object.entries({ within, reached, over })) {
      expect(seen.frame, `the limit figure has a frame when ${state}`).toEqual([0, 0, 0, 0]);
      expect(seen.places, `the figures above moved when ${state}`).toEqual(first.places);
    }
  });

  test('the box fits at 320, 375 and 393 px with the largest amounts', testCase('TC-E2E-085'), async ({ signedIn, api }) => {
    const month = new MonthPage(signedIn);
    const [groceries] = await api.categories();

    const expectFits = async () => {
      for (const width of [320, 375, 393]) {
        await signedIn.setViewportSize({ width, height: 740 });
        const box = await month.limitStatus.boundingBox();
        const head = await month.head.boundingBox();
        const overflow = await month.limitStatus.evaluate((el) => ({
          clipped: el.scrollWidth > el.clientWidth,
          page: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        }));
        expect(overflow.page, `${width} px: the page scrolls sideways`).toBe(0);
        expect(overflow.clipped, `${width} px: the status text is clipped`).toBe(false);
        expect(box.x, `${width} px: the box starts outside the header`).toBeGreaterThanOrEqual(head.x);
        expect(box.x + box.width, `${width} px: the box ends outside the header`).toBeLessThanOrEqual(head.x + head.width);
      }
    };

    // The longest sentence the outline can hold: the largest limit, untouched.
    await api.setSettings({ monthly_income_cents: 100000000, monthly_limit_cents: 100000000 });
    await month.goToMonth();
    await expect(month.limitStatus).toHaveText(`Within limit · ${eur(100000000)} left`);
    await expectFits();

    // The widest red box: a zero limit and ten expenses at the amount ceiling.
    await api.setSettings({ monthly_income_cents: 100000000, monthly_limit_cents: 0 });
    await api.addExpenses(10, { amount_cents: 100000000, category_id: groceries.id });
    await signedIn.reload();
    await month.goToMonth();
    await expect(month.limitStatus).toHaveText(`Over limit by ${eur(1000000000)}`);
    await expectFits();
  });
});
