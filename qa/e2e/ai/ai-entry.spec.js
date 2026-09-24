'use strict';

const { test, expect } = require('../fixtures/wallet');
const { AddPage } = require('../pages/add.page');
const { AiExpensePage } = require('../pages/ai-expense.page');
const { fake, answer, countExpenses, localDay, lastDayOfPreviousMonth, MONTHS } = require('./support/fake-control');

/**
 * AI expense entry in the browser, live mode, against the local fake provider.
 *
 * The property every test ends on is the same one: what reached the database
 * is exactly what the person saved, and nothing before they pressed Save.
 * Default categories are seeded in id order, so Restaurants is ref c3.
 */

const LUNCH_UK = 'Учора витратив 18 євро на обід';
const lunchUk = answer({ language: 'uk', amount_text: '18', currency_text: 'євро', date_text: 'Учора', category_ref: 'c3', note_text: 'обід' });

test.beforeEach(async () => { await fake.reset(); });

test.describe('AI entry · live mode', () => {
  test('the entry point asks for consent and calls nothing until Suggest', async ({ signedIn }) => {
    const ai = new AiExpensePage(signedIn);
    await expect(ai.openButton).toBeVisible();
    await ai.openButton.click();

    await expect(ai.dialog).toBeVisible();
    await expect(ai.liveNotice).toBeVisible();
    await expect(ai.demoBanner).toBeHidden();
    await expect(ai.consent).not.toBeChecked();
    await expect(ai.suggest).toBeDisabled();

    await ai.text.fill('Yesterday I paid 18 euros for lunch');
    await expect(ai.suggest).toBeDisabled();
    await ai.consent.check();
    await expect(ai.suggest).toBeEnabled();

    expect((await fake.state()).requests, 'opening and typing call nothing').toBe(0);
  });

  test('ready draft: reviewed values, provenance, saved only on Save, manual Add untouched', async ({ signedIn, request, user }) => {
    const add = new AddPage(signedIn);
    const ai = new AiExpensePage(signedIn);
    await add.enterAmount('12');
    await expect(add.amount).toHaveText('€0.12');

    await fake.plan(lunchUk);
    await ai.requestSuggestion(LUNCH_UK);

    await expect(ai.reviewForm).toBeVisible();
    await expect(ai.source).toHaveText(LUNCH_UK);
    await expect(ai.amount).toHaveValue('18.00');
    await expect(ai.amountHint).toHaveText('Found in your description');
    await expect(ai.currencyHint).toHaveText('EUR — found in your description');
    await expect(ai.category).toHaveValue(/\d+/);
    await expect(ai.category.getByRole('option', { selected: true })).toHaveText(/Restaurants/);
    await expect(ai.categoryHint).toHaveText('Suggested category');
    await expect(ai.date).toHaveValue(localDay(-1));
    await expect(ai.note).toHaveValue('обід');
    expect(await countExpenses(request, user.token), 'a draft is not an expense').toBe(0);

    await ai.save.click();
    await expect(ai.dialog).toBeHidden();
    const yesterday = localDay(-1);
    const expected = yesterday.slice(0, 7) === localDay(0).slice(0, 7)
      ? 'Saved · €18.00'
      : `Saved for ${Number(yesterday.slice(8))} ${MONTHS[Number(yesterday.slice(5, 7)) - 1]} · €18.00`;
    await expect(ai.toastSuccess).toHaveText(expected);
    expect(await countExpenses(request, user.token)).toBe(1);
    await expect(add.amount, 'the manual amount survived').toHaveText('€0.12');
  });

  test('needs input: Save waits for the missing amount, then saves what was typed', async ({ signedIn, request, user }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan(answer({ date_text: 'yesterday', category_ref: 'c3', note_text: 'Lunch' }));
    await ai.requestSuggestion('Lunch yesterday');

    await expect(ai.status).toHaveText('Complete the highlighted fields, then save.');
    await expect(ai.amount).toHaveValue('');
    await expect(ai.amountHint).toHaveText('Please enter an amount');
    await expect(ai.save).toBeDisabled();

    await ai.amount.fill('9,50');
    await expect(ai.amountHint).toHaveText('Changed by you');
    await expect(ai.save).toBeEnabled();
    await ai.save.click();
    await expect(ai.toastSuccess).toContainText('€9.50');
    expect(await countExpenses(request, user.token)).toBe(1);
  });

  test('unsupported: a foreign currency gets an explanation and no Save', async ({ signedIn, request, user }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan(answer({ amount_text: '10', currency_text: 'USD', category_ref: 'c3', note_text: 'Lunch' }));
    await ai.requestSuggestion('Lunch 10 USD');

    await expect(ai.status).toHaveText('Only expenses in euro can be added.');
    await expect(ai.amount).toBeHidden();
    await expect(ai.save).toBeHidden();
    await ai.editDescription.click();
    await expect(ai.text).toHaveValue('Lunch 10 USD');
    expect(await countExpenses(request, user.token)).toBe(0);
  });

  test('a provider failure is a recoverable message, not a draft', async ({ signedIn, request, user }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan({ status: 500 });
    await ai.requestSuggestion('Lunch 9 EUR');

    await expect(ai.error).toHaveText('The AI service did not answer. Try again or enter the expense manually.');
    await expect(ai.reviewForm).toBeHidden();
    await expect(ai.text).toHaveValue('Lunch 9 EUR');
    await expect(ai.suggest).toBeEnabled();
    expect(await countExpenses(request, user.token)).toBe(0);
  });

  test('a response that arrives after Cancel is not applied', async ({ signedIn }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan({ ...lunchUk, gate: 'after-cancel' });
    await ai.requestSuggestion(LUNCH_UK);
    await expect(ai.progress).toBeVisible();
    await expect.poll(async () => (await fake.state()).requests).toBe(1);

    await ai.cancel.click();
    await expect(ai.dialog).toBeHidden();
    await fake.openGate('after-cancel');

    await ai.openButton.click();
    await expect(ai.text).toHaveValue('');
    await expect(ai.editForm).toBeVisible();
    await expect(ai.reviewForm).toBeHidden();
  });

  test('changing the words while waiting drops the old suggestion', async ({ signedIn }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan({ ...lunchUk, gate: 'while-typing' });
    await ai.requestSuggestion(LUNCH_UK);
    await expect.poll(async () => (await fake.state()).requests).toBe(1);

    await ai.text.press('End');
    await ai.text.pressSequentially(' і каву');
    await expect(ai.progress).toBeHidden();
    await fake.openGate('while-typing');

    await expect(ai.suggest).toBeEnabled();
    await expect(ai.reviewForm).toBeHidden();
    await expect(ai.text).toHaveValue(`${LUNCH_UK} і каву`);
  });

  test('two clicks on Save make one expense', async ({ signedIn, request, user }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan(lunchUk);
    await ai.requestSuggestion(LUNCH_UK);
    await expect(ai.save).toBeEnabled();
    await ai.save.dblclick();
    await expect(ai.dialog).toBeHidden();
    expect(await countExpenses(request, user.token)).toBe(1);
  });

  test('a save whose answer is lost is retried with the same key: still one expense', async ({ signedIn, request, user }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan(lunchUk);
    await ai.requestSuggestion(LUNCH_UK);
    await expect(ai.save).toBeEnabled();

    // The server commits, the connection drops before the browser hears it.
    let keys = [];
    await signedIn.route('**/api/transactions', async (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      await route.fetch();
      await route.abort('failed');
    });
    await ai.save.click();

    await expect(ai.saveError).toContainText('We could not confirm the save.');
    await expect(ai.retrySave).toBeVisible();
    await expect(ai.amount).toBeDisabled();
    await ai.close.click();
    await expect(ai.dialog, 'an uncertain save does not vanish on Close').toBeVisible();
    expect(await countExpenses(request, user.token), 'the first attempt did commit').toBe(1);

    await signedIn.unroute('**/api/transactions');
    await signedIn.route('**/api/transactions', async (route) => {
      keys.push(route.request().headers()['idempotency-key']);
      await route.continue();
    });
    await ai.retrySave.click();
    await expect(ai.dialog).toBeHidden();
    await expect(ai.toastSuccess).toContainText('€18.00');
    expect(await countExpenses(request, user.token), 'the retry replayed, it did not insert').toBe(1);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toMatch(/^[0-9a-f-]{8,64}$/);
    expect(keys[1]).toBe(keys[0]);
  });

  test('a date in the previous month says where the expense went', async ({ signedIn }) => {
    const day = lastDayOfPreviousMonth();
    const ai = new AiExpensePage(signedIn);
    const description = `Lunch 18 EUR on ${day}`;
    await fake.plan(answer({ amount_text: '18', currency_text: 'EUR', date_text: day, category_ref: 'c3', note_text: 'Lunch' }));
    await ai.requestSuggestion(description);
    await expect(ai.date).toHaveValue(day);
    await ai.save.click();
    await expect(ai.toastSuccess).toHaveText(`Saved for ${Number(day.slice(8))} ${MONTHS[Number(day.slice(5, 7)) - 1]} · €18.00`);
  });

  test('markup in the description and note is shown as text and never runs', async ({ signedIn, request, user }) => {
    const markup = '<img src=x onerror="window.__walletXss=1">';
    const description = `${markup} 9 EUR`;
    const ai = new AiExpensePage(signedIn);
    await fake.plan(answer({ amount_text: '9', currency_text: 'EUR', category_ref: 'c0', note_text: markup }));
    await ai.requestSuggestion(description);

    await expect(ai.source).toHaveText(description);
    await expect(ai.note).toHaveValue(markup.slice(0, 60));
    await expect(ai.source.getByRole('img')).toHaveCount(0);
    expect(await signedIn.evaluate(() => window.__walletXss)).toBeUndefined();
    expect(await countExpenses(request, user.token)).toBe(0);
  });

  test('the counter counts characters as the server does: 500 emoji fit, 501 do not', async ({ signedIn }) => {
    const ai = new AiExpensePage(signedIn);
    await ai.openButton.click();
    await ai.consent.check();
    await ai.text.fill('😀'.repeat(500));
    await expect(ai.count).toHaveText('500 / 500');
    await expect(ai.suggest).toBeEnabled();
    await ai.text.fill('😀'.repeat(501));
    await expect(ai.count).toHaveText('501 / 500 — too long, shorten the description');
    await expect(ai.suggest).toBeDisabled();
  });

  test('keyboard: the dialog takes focus, Escape closes it, focus returns', async ({ signedIn }) => {
    const ai = new AiExpensePage(signedIn);
    await ai.openButton.focus();
    await signedIn.keyboard.press('Enter');
    await expect(ai.dialog).toBeVisible();
    await expect(ai.text).toBeFocused();
    await signedIn.keyboard.press('Escape');
    await expect(ai.dialog).toBeHidden();
    await expect(ai.openButton).toBeFocused();
  });

  test('when the feature is off there is no entry point', async ({ page, user }) => {
    await page.route('**/api/ai/capabilities', (route) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ enabled: false, mode: 'off', provider: null, max_input_chars: 500, languages: ['en', 'uk', 'sk'], requires_external_consent: false }),
    }));
    await page.addInitScript((token) => window.localStorage.setItem('wallet_token', token), user.token);
    await page.goto('/');
    const add = new AddPage(page);
    const ai = new AiExpensePage(page);
    await expect(add.tile('Groceries')).toBeVisible();
    await expect(ai.openButton).toBeHidden();
  });
});

test.describe('AI entry · 320x568', () => {
  test.use({ viewport: { width: 320, height: 568 } });

  test('every review field and Save can be reached; nothing scrolls sideways', async ({ signedIn, request, user }) => {
    const ai = new AiExpensePage(signedIn);
    await fake.plan(lunchUk);
    await ai.requestSuggestion(LUNCH_UK);
    await expect(ai.reviewForm).toBeVisible();

    for (const control of [ai.amount, ai.category, ai.date, ai.note, ai.save]) {
      await control.scrollIntoViewIfNeeded();
      // 0.99, not 1: the scrolling review body clips a sub-pixel sliver off a control that fits inside it — 0.30px on CI run 36000657644, 0.28px measured here.
      await expect(control).toBeInViewport({ ratio: 0.99 });
    }
    const width = await signedIn.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(320);
    await ai.save.click();
    await expect(ai.dialog).toBeHidden();
    expect(await countExpenses(request, user.token)).toBe(1);
  });
});
