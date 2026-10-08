'use strict';

const AxeBuilder = require('@axe-core/playwright').default;
const { test, expect } = require('../e2e/fixtures/wallet');
const { AddPage } = require('../e2e/pages/add.page');
const { MonthPage } = require('../e2e/pages/month.page');
const { SchedulesPage } = require('../e2e/pages/schedules.page');
const { UpcomingPage } = require('../e2e/pages/upcoming.page');
const { AiExpensePage } = require('../e2e/pages/ai-expense.page');

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function scan(page, testInfo, state) {
  // Whole rendered page: no selector exclusions, disabled rules or post-filtering.
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.testEngine.name).toBe('axe-core');
  expect(results.passes.length + results.violations.length + results.incomplete.length)
    .toBeGreaterThan(0);
  await testInfo.attach(`${state}-axe.json`, {
    body: JSON.stringify({ project: testInfo.project.name, state, tags: WCAG_TAGS, ...results }, null, 2),
    contentType: 'application/json',
  });
  const counts = (items) => items.map(({ id, nodes }) => `${id}:${nodes.length}`).join(',') || 'none';
  console.log(`A11Y ${testInfo.project.name} ${state} violations=${counts(results.violations)} incomplete=${counts(results.incomplete)}`);
  // Full evidence is attached before this assertion. Incomplete stays visible
  // in the report and is never treated as a confirmed pass.
  expect(results.violations, `${testInfo.project.name} / ${state}: automatic WCAG-tagged violations`).toEqual([]);
  return results;
}

test('authentication sign-in and registration states', async ({ page }, testInfo) => {
  await page.goto('/');
  await expect(page.getByTestId('auth-submit')).toHaveText('Sign in');
  await scan(page, testInfo, 'auth-sign-in');

  await page.getByTestId('auth-toggle').click();
  await expect(page.getByTestId('auth-submit')).not.toHaveText('Sign in');
  await scan(page, testInfo, 'auth-registration');
});

test('Add, Month, category and expense dialogs, Upcoming and Schedules', async ({ signedIn, api }, testInfo) => {
  const add = new AddPage(signedIn);
  const month = new MonthPage(signedIn);
  const upcoming = new UpcomingPage(signedIn);
  const schedules = new SchedulesPage(signedIn);

  await expect(add.tile('Groceries')).toBeVisible();
  await scan(signedIn, testInfo, 'add-empty');
  await add.save.click();
  await expect(add.toastError).toHaveText('Enter an amount');
  await scan(signedIn, testInfo, 'add-validation-error');

  const [category] = await api.categories();
  await api.setCategoryLimit(category.id, 2000);
  const transaction = await api.addExpense({ amount_cents: 1250, category_id: category.id, note: 'Sample expense' });
  await month.goToMonth();
  await expect(month.row(transaction.id)).toBeVisible();
  await expect(month.categoryLimitStatus(category.id)).toBeVisible();
  await scan(signedIn, testInfo, 'month-with-category-limit');

  await month.categoryLimitEdit(category.id).click();
  await expect(month.categoryLimitDialog).toBeVisible();
  await expect(month.categoryLimitInput).toBeFocused();
  await scan(signedIn, testInfo, 'category-limit-dialog');
  for (const key of ['Tab', 'Tab', 'Shift+Tab']) {
    await signedIn.keyboard.press(key);
    expect(await month.categoryLimitDialog.evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await signedIn.keyboard.press('Escape');
  await expect(month.categoryLimitDialog).toBeHidden();
  await expect(month.categoryLimitEdit(category.id)).toBeFocused();

  await month.editButton(transaction.id).click();
  await expect(month.editAmount).toBeVisible();
  await scan(signedIn, testInfo, 'expense-edit-sheet');
  await month.editCancel.click();
  await expect(month.editAmount).toBeHidden();

  const schedule = await api.addSchedule({
    name: 'Sample subscription', amount_cents: 1399,
    day_of_month: 8, starts_on: '2026-01-01',
  });
  await upcoming.goToUpcoming();
  await expect(upcoming.row(schedule.id)).toBeVisible();
  await scan(signedIn, testInfo, 'upcoming-with-payment');

  await schedules.goToSchedules();
  await expect(schedules.row(schedule.id)).toBeVisible();
  await scan(signedIn, testInfo, 'schedules-with-payment');
});

test('AI demo description and review dialog', async ({ signedIn }, testInfo) => {
  const ai = new AiExpensePage(signedIn);
  await expect(ai.openButton).toBeVisible();
  await ai.openButton.focus();
  await signedIn.keyboard.press('Enter');
  await expect(ai.dialog).toBeVisible();
  await expect(ai.text).toBeFocused();
  await expect(ai.demoBanner).toBeVisible();
  await scan(signedIn, testInfo, 'ai-demo-description');

  await ai.exampleEn.click();
  await expect(ai.suggest).toBeEnabled();
  await ai.suggest.click();
  await expect(ai.reviewForm).toBeVisible();
  await expect(ai.amount).toHaveValue('18.00');
  await scan(signedIn, testInfo, 'ai-demo-review');
  await signedIn.keyboard.press('Escape');
  await expect(ai.dialog).toBeHidden();
  await expect(ai.openButton).toBeFocused();
});

test('negative control: missing image alternative is detected', async ({ page }) => {
  await page.setContent('<!doctype html><html lang="en"><head><title>Control</title></head><body><main><img src="data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs"></main></body></html>');
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  expect(results.violations.map(({ id }) => id)).toContain('image-alt');
});

test('keyboard reaches navigation, Schedules and the expense editor', async ({ signedIn, api }) => {
  const nav = signedIn.getByRole('navigation', { name: 'Main navigation' });
  const buttons = ['Add', 'Month', 'Upcoming', 'Schedules'].map(name =>
    nav.getByRole('button', { name, exact: true }));
  const schedules = new SchedulesPage(signedIn);
  const month = new MonthPage(signedIn);
  const focusRing = async (locator) => {
    await expect(locator).toBeFocused();
    expect(await locator.evaluate(el => el.matches(':focus-visible'))).toBe(true);
    expect(await locator.evaluate(el => getComputedStyle(el).outlineStyle)).not.toBe('none');
  };
  const tabTo = async (locator, label, limit = 4) => {
    for (let step = 0; step < limit; step++) {
      await signedIn.keyboard.press('Tab');
      if (await locator.evaluate(el => document.activeElement === el)) {
        await focusRing(locator);
        return;
      }
    }
    const actual = await signedIn.evaluate(() => document.activeElement?.getAttribute('data-testid') || document.activeElement?.tagName);
    throw new Error(`${label} was not reached within ${limit} Tabs; active=${actual}`);
  };

  await expect(buttons[0]).toHaveAttribute('aria-current', 'page');
  await buttons[0].focus();
  for (let i = 1; i < buttons.length; i++) {
    await signedIn.keyboard.press('Tab');
    await focusRing(buttons[i]);
    await signedIn.keyboard.press('Enter');
    await expect(buttons[i]).toHaveAttribute('aria-current', 'page');
  }

  // Browser tab order may cross other visible controls after the fixed nav.
  // Prove reachability within a small bound, not an assumed one-Tab wrap.
  await tabTo(schedules.name, 'Schedules Name', 8);
  for (const control of [schedules.amount, schedules.category, schedules.day,
    schedules.startsOn, schedules.isLoan, schedules.save]) {
    await tabTo(control, 'Schedules form control');
  }

  await buttons[1].focus();
  await signedIn.keyboard.press('Shift+Tab');
  await focusRing(buttons[0]);
  await signedIn.keyboard.press('Enter');
  await expect(buttons[0]).toHaveAttribute('aria-current', 'page');

  const [category] = await api.categories();
  const transaction = await api.addExpense({ amount_cents: 1250, category_id: category.id });
  await buttons[1].focus();
  await signedIn.keyboard.press('Enter');
  await expect(month.row(transaction.id)).toBeVisible();
  await month.editButton(transaction.id).focus();
  await signedIn.keyboard.press('Enter');
  await expect(month.editAmount).toBeFocused();
  await signedIn.keyboard.press('Escape');
  await expect(month.editAmount).toBeHidden();
  await expect(month.editButton(transaction.id)).toBeFocused();
});
