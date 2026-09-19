'use strict';

const { test, expect, eurWithin, remainingPattern } = require('./fixtures/wallet');
const { testCase } = require('./case-link');
const { SchedulesPage } = require('./pages/schedules.page');

/** Screen 6.4 — the form, and the one branch in it. */

/** The next February still ahead of us, so the expected date never drifts (R1). */
function nextFebruary() {
  const year = new Date().getFullYear() + 1;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return { startsOn: `${year}-02-01`, lastDay: leap ? 29 : 28 };
}

test.describe('Schedules', () => {
  test('a subscription is created and listed', testCase('TC-E2E-017'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Telekom',
      amount: '15.00',
      day: 12,
      startsOn: '2026-01-01',
    });

    await expect(schedules.toastSuccess).toHaveText('Telekom · added');
    await expect(schedules.rows).toHaveCount(1);
    await expect(schedules.rows.first()).toContainText('Telekom');
  });

  test('the loan checkbox is the only branch in the form', testCase('TC-E2E-018'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await expect(schedules.totalCount).toBeHidden();

    await schedules.isLoan.check();
    await expect(schedules.totalCount).toBeVisible();

    await schedules.isLoan.uncheck();
    await expect(schedules.totalCount).toBeHidden();
  });

  test('a loan shows its countdown from the moment it is created', testCase('TC-E2E-019'), async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Laptop loan',
      amount: '100.00',
      day: 15,
      startsOn: '2026-01-01',
      totalCount: 10,
    });

    await expect(schedules.toastSuccess).toBeVisible();
    await expect(schedules.rows).toHaveCount(1);

    // The id comes from the API, so the assertion addresses one specific row
    // rather than "whichever happens to be first".
    const [created] = await api.schedules();
    await expect(schedules.row(created.id)).toContainText('Laptop loan');
    // 10 instalments of €100.00 outstanding: the countdown line, exactly.
    await expect(schedules.remaining(created.id)).toHaveText(remainingPattern(10, 10, 10000));
  });

  test('the 31st is accepted and explains itself', testCase('TC-E2E-020'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);
    const { startsOn, lastDay } = nextFebruary();

    await schedules.goToSchedules();

    await schedules.day.fill('12');
    await expect(schedules.dayHint).toHaveText('');

    await schedules.day.fill('31');
    await expect(schedules.dayHint).toHaveText(
      'In months with no 31st, the payment is taken on the last day of the month.'
    );

    await schedules.name.fill('Rent');
    await schedules.amount.fill('500.00');
    await schedules.startsOn.fill(startsOn);
    await schedules.save.click();

    await expect(schedules.toastSuccess).toBeVisible();
    // Clamped to the last day of February — not skipped (spec §4.1).
    await expect(schedules.rows.first()).toContainText(`${lastDay} Feb`);
  });

  test('a malformed amount is refused before anything is sent', testCase('TC-E2E-021'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Nonsense',
      amount: 'not a number',
      day: 5,
      startsOn: '2026-01-01',
    });

    await expect(schedules.toastError).toHaveText('Amount must be a number, for example 15.00');
    await expect(schedules.rows).toHaveCount(0);
  });

  test('a day outside 1–31 is refused', testCase('TC-E2E-022'), async ({ signedIn }) => {
    const schedules = new SchedulesPage(signedIn);

    await schedules.goToSchedules();
    await schedules.create({
      name: 'Day 32',
      amount: '10.00',
      day: 32,
      startsOn: '2026-01-01',
    });

    await expect(schedules.toastError).toHaveText('Day of month must be between 1 and 31');
    await expect(schedules.rows).toHaveCount(0);
  });

  test('a schedule created through the API is shown with its amount', testCase('TC-E2E-023'), async ({ signedIn, api }) => {
    const schedules = new SchedulesPage(signedIn);
    const created = await api.addSchedule({
      name: 'Netflix',
      amount_cents: 1399,
      day_of_month: 8,
      starts_on: '2026-01-01',
    });

    await schedules.goToSchedules();

    await expect(schedules.row(created.id)).toBeVisible();
    await expect(schedules.row(created.id)).toContainText('Netflix');
    await expect(schedules.remaining(created.id)).toHaveText('Subscription');
    await expect(schedules.row(created.id)).toContainText(eurWithin(1399));
  });
});
