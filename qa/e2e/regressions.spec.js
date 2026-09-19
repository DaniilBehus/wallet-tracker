'use strict';

const { test, expect, remainingPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { AddPage } = require('./pages/add.page');
const { UpcomingPage } = require('./pages/upcoming.page');
const { contrastRatio } = require('./support/contrast');

/**
 * Regression guards for closed defects, one per defect, named by its id.
 *
 * These are deliberately narrow. Elsewhere in the suite a test covers a flow;
 * here each test covers exactly the thing that was once broken, so that when
 * one fails the report names the defect that came back rather than a screen
 * that stopped working for some reason.
 *
 * Reports: log/BUGS.md.
 */

/**
 * The colour actually painted behind an element.
 *
 * `backgroundColor` on the element itself can be rgba(…, 0) — fully
 * transparent — in which case what a person sees is whatever the nearest
 * painted ancestor has. Walking up is the difference between testing the
 * declaration and testing the appearance.
 */
const EFFECTIVE_COLOURS = (el) => {
  const own = getComputedStyle(el);
  let node = el;
  let background = own.backgroundColor;

  while (node && /rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)/.test(background)) {
    node = node.parentElement;
    background = node ? getComputedStyle(node).backgroundColor : 'rgb(255, 255, 255)';
  }

  return { color: own.color, background: background || 'rgb(255, 255, 255)' };
};

test.describe('Regressions', () => {
  test('BUG-001 · the Save button is legible, not white on white', testCase('TC-REG-001'), async ({ signedIn }) => {
    const add = new AddPage(signedIn);

    await expect(add.save).toBeVisible();
    await expect(add.save).toHaveText('Save');

    // The assertions above are exactly the ones BUG-001 passed while the button
    // was invisible. Everything below is the part that would have caught it.
    const { color, background } = await add.save.evaluate(EFFECTIVE_COLOURS);

    expect(
      color,
      'the label and the button are the same colour — this is BUG-001 exactly'
    ).not.toBe(background);

    const ratio = contrastRatio(color, background);
    expect(
      ratio,
      `contrast of ${color} on ${background} is ${ratio.toFixed(2)}:1, below the 4.5:1 ` +
        'that makes text readable (WCAG AA)'
    ).toBeGreaterThanOrEqual(4.5);
  });

  test('BUG-002 · the counter reads zero after the last instalment', testCase('TC-REG-002'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);

    // Two instalments: enough to have a payment that does not finish the loan
    // and one that does. The defect lived only on the second kind, because a
    // payment that does not finish triggers a full re-render and a payment
    // that does patches the row in place.
    const loan = await api.addSchedule({
      name: 'BUG-002 regression',
      amount_cents: 5000,
      day_of_month: 15,
      starts_on: '2026-01-01',
      total_count: 2,
    });

    await upcoming.goToUpcoming();
    await expect(upcoming.remaining(loan.id)).toHaveText(remainingPattern(2, 2, 5000));

    await upcoming.pay(loan.id);
    await expect(upcoming.remaining(loan.id)).toHaveText(remainingPattern(1, 2, 5000));

    await upcoming.pay(loan.id);

    // The defect: this read "1 of 2 left · €50.00" — a loan the user had just
    // finished paying, still claiming one instalment was owed.
    await expect(
      upcoming.remaining(loan.id),
      'the countdown must reach zero on the final payment'
    ).toHaveText(remainingPattern(0, 2, 5000));

    await expect(upcoming.finishedBadge(loan.id)).toBeVisible();
    await expect(upcoming.payButton(loan.id)).toHaveCount(0);
  });

  test('BUG-003 · the pay button recovers after a refused payment', testCase('TC-REG-003'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);

    const loan = await api.addSchedule({
      name: 'BUG-003 regression',
      amount_cents: 2500,
      day_of_month: 10,
      starts_on: '2026-01-01',
      total_count: 1,
    });

    await upcoming.goToUpcoming();
    await expect(upcoming.payButton(loan.id)).toBeVisible();

    // Closed behind the screen's back, as a second tab would.
    await api.paySchedule(loan.id);
    await upcoming.pay(loan.id);

    await expect(upcoming.toastError).toHaveText('This schedule is already closed.');
    await expect(upcoming.payButton(loan.id)).toHaveText('Pay');
    await expect(upcoming.payButton(loan.id)).toBeEnabled();
  });
});
