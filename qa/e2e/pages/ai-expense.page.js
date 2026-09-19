'use strict';

const { BasePage } = require('./base.page');

/**
 * The "Describe an expense" dialog (spec/ai-expense-entry.md).
 * Test ids only, as everywhere in this directory (D-012).
 */
class AiExpensePage extends BasePage {
  constructor(page) {
    super(page);

    this.openButton = page.getByTestId('ai-open');
    this.dialog = page.getByTestId('ai-dialog');
    this.close = page.getByTestId('ai-close');
    this.demoBanner = page.getByTestId('ai-demo-banner');

    // describing
    this.editForm = page.getByTestId('ai-edit');
    this.text = page.getByTestId('ai-text');
    this.count = page.getByTestId('ai-count');
    this.exampleEn = page.getByTestId('ai-example-en');
    this.exampleUk = page.getByTestId('ai-example-uk');
    this.exampleSk = page.getByTestId('ai-example-sk');
    this.liveNotice = page.getByTestId('ai-live-notice');
    this.consent = page.getByTestId('ai-consent');
    this.progress = page.getByTestId('ai-progress');
    this.error = page.getByTestId('ai-error');
    this.suggest = page.getByTestId('ai-suggest');
    this.cancel = page.getByTestId('ai-cancel');

    // reviewing
    this.reviewForm = page.getByTestId('ai-review');
    this.source = page.getByTestId('ai-source');
    this.status = page.getByTestId('ai-status');
    this.amount = page.getByTestId('ai-amount');
    this.amountHint = page.getByTestId('ai-amount-hint');
    this.currencyHint = page.getByTestId('ai-currency-hint');
    this.category = page.getByTestId('ai-category');
    this.categoryHint = page.getByTestId('ai-category-hint');
    this.date = page.getByTestId('ai-date');
    this.dateHint = page.getByTestId('ai-date-hint');
    this.note = page.getByTestId('ai-note');
    this.noteHint = page.getByTestId('ai-note-hint');
    this.saveError = page.getByTestId('ai-save-error');
    this.save = page.getByTestId('ai-save');
    this.retrySave = page.getByTestId('ai-retry-save');
    this.abandon = page.getByTestId('ai-abandon');
    this.editDescription = page.getByTestId('ai-edit-description');
  }

  /** Open the dialog, write a description and, in live mode, give consent. */
  async describe(description, { consent = true } = {}) {
    await this.openButton.click();
    await this.text.fill(description);
    if (consent && await this.consent.isVisible()) await this.consent.check();
  }

  async requestSuggestion(description, options) {
    await this.describe(description, options);
    await this.suggest.click();
  }
}

module.exports = { AiExpensePage };
