'use strict';

const { test, expect } = require('../fixtures/wallet');
const { AiExpensePage } = require('../pages/ai-expense.page');
const { countExpenses, localDay } = require('./support/fake-control');

/**
 * `npm run ai:demo` in the browser. No consent step, a visible demo label, and
 * honesty about anything outside the named examples.
 */

test.use({ baseURL: process.env.QA_AI_DEMO_URL });

test.describe('AI entry · demo mode', () => {
  for (const [language, button] of [['EN', 'exampleEn'], ['UK', 'exampleUk'], ['SK', 'exampleSk']]) {
    test(`the ${language} example becomes an 18 euro lunch yesterday`, async ({ signedIn, request, user }) => {
      const ai = new AiExpensePage(signedIn);
      await ai.openButton.click();
      await expect(ai.demoBanner).toHaveText('Demo — sample responses, no AI service contacted');
      await expect(ai.liveNotice).toBeHidden();

      await ai[button].click();
      await expect(ai.suggest).toBeEnabled();
      await ai.suggest.click();

      await expect(ai.amount).toHaveValue('18.00');
      await expect(ai.category.getByRole('option', { selected: true })).toHaveText(/Restaurants/);
      await expect(ai.date).toHaveValue(localDay(-1));
      expect(await countExpenses(request, user.token)).toBe(0);
    });
  }

  test('a sentence outside the examples is not invented', async ({ signedIn }) => {
    const ai = new AiExpensePage(signedIn);
    await ai.requestSuggestion('Dinner 25 EUR yesterday');
    await expect(ai.status).toHaveText('This sentence is not one of the demo examples. Try an example button.');
    await expect(ai.save).toBeHidden();
  });
});
