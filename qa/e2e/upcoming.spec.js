'use strict';

const { test, expect, eurPattern, remainingPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { UpcomingPage } = require('./pages/upcoming.page');
const { MonthPage } = require('./pages/month.page');

/**
 * Screen 6.3 — paying schedules, and the loan countdown from spec §4.2.
 *
 * This is where BUG-002 lived: the last payment closed the loan but left the
 * countdown showing one instalment still owed. The countdown is therefore
 * asserted after every payment, not only at the end.
 */

test.describe('Upcoming', () => {
  test('a loan counts down to zero and closes itself', testCase('TC-E2E-024'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);

    const loan = await api.addSchedule({
      name: 'Loan',
      amount_cents: 5000,
      day_of_month: 15,
      starts_on: '2026-01-01',
      total_count: 3,
    });

    await upcoming.goToUpcoming();
    await expect(upcoming.remaining(loan.id)).toHaveText(remainingPattern(3, 3, 5000));

    await upcoming.pay(loan.id);
    await expect(upcoming.toastSuccess).toBeVisible();
    await expect(upcoming.remaining(loan.id)).toHaveText(remainingPattern(2, 3, 5000));

    await upcoming.pay(loan.id);
    await expect(upcoming.remaining(loan.id)).toHaveText(remainingPattern(1, 3, 5000));

    // The last instalment: the countdown must reach zero, not stop at one.
    await upcoming.pay(loan.id);
    await expect(upcoming.remaining(loan.id)).toHaveText(remainingPattern(0, 3, 5000));
    await expect(upcoming.finishedBadge(loan.id)).toBeVisible();
    await expect(upcoming.payButton(loan.id)).toHaveCount(0);
  });

  test('a subscription has no countdown and never finishes', testCase('TC-E2E-025'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);

    const subscription = await api.addSchedule({
      name: 'Telekom',
      amount_cents: 1500,
      day_of_month: 12,
      starts_on: '2026-01-01',
    });

    await upcoming.goToUpcoming();
    await expect(upcoming.remaining(subscription.id)).toHaveText('Subscription');

    await upcoming.pay(subscription.id);
    await expect(upcoming.toastSuccess).toBeVisible();

    // Still there, still payable, still without a countdown.
    await expect(upcoming.row(subscription.id)).toBeVisible();
    await expect(upcoming.payButton(subscription.id)).toBeVisible();
    await expect(upcoming.remaining(subscription.id)).toHaveText('Subscription');
    await expect(upcoming.finishedBadge(subscription.id)).toHaveCount(0);
  });

  test('paying a schedule records the expense in this month', testCase('TC-E2E-026'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);
    const month = new MonthPage(signedIn);

    const subscription = await api.addSchedule({
      name: 'Telekom',
      amount_cents: 1500,
      day_of_month: 12,
      starts_on: '2026-01-01',
    });

    await upcoming.goToUpcoming();
    await upcoming.pay(subscription.id);
    await expect(upcoming.toastSuccess).toBeVisible();

    await upcoming.goToMonth();
    await expect(month.total).toHaveText(eurPattern(1500));
    await expect(month.rows).toHaveCount(1);
    await expect(month.rows.first()).toContainText('Telekom');
  });

  test('a closed loan disappears from Upcoming after a reload', testCase('TC-E2E-027'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);

    const loan = await api.addSchedule({
      name: 'Short loan',
      amount_cents: 2000,
      day_of_month: 3,
      starts_on: '2026-01-01',
      total_count: 1,
    });
    await api.paySchedule(loan.id);

    await upcoming.goToUpcoming();

    await expect(upcoming.rows).toHaveCount(0);
    await expect(upcoming.row(loan.id)).toHaveCount(0);
  });

  test('schedules are listed by when they are next due', testCase('TC-E2E-028'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);

    await api.addSchedule({
      name: 'Later', amount_cents: 1000, day_of_month: 28, starts_on: '2026-01-01',
    });
    await api.addSchedule({
      name: 'Sooner', amount_cents: 1000, day_of_month: 1, starts_on: '2026-01-01',
    });

    await upcoming.goToUpcoming();
    await expect(upcoming.rows).toHaveCount(2);

    const fromApi = await api.schedules();
    const due = fromApi.map((s) => s.next_due);
    expect(due, 'the API must return them sorted by next_due').toEqual([...due].sort());

    // The screen must present them in the same order the API returned.
    await expect(upcoming.rows.first()).toContainText(fromApi[0].name);
    await expect(upcoming.rows.last()).toContainText(fromApi[1].name);
  });

  test('the pay button says what it will pay', testCase('TC-E2E-029'), async ({ signedIn, api }) => {
    const upcoming = new UpcomingPage(signedIn);
    const subscription = await api.addSchedule({
      name: 'Netflix', amount_cents: 1399, day_of_month: 8, starts_on: '2026-01-01',
    });

    await upcoming.goToUpcoming();

    // By role and accessible name: the button is reachable the way a screen
    // reader user reaches it, not only by its test id (D-012).
    await expect(
      signedIn.getByRole('button', { name: 'Pay Netflix', exact: true })
    ).toBeVisible();
    await expect(upcoming.payButton(subscription.id)).toBeVisible();
  });
});
