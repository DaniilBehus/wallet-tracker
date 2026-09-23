'use strict';

const { BasePage } = require('./base.page');

/** Screen 6.2 — the month total, the category bars, the list of expenses. */
class MonthPage extends BasePage {
  constructor(page) {
    super(page);

    this.total = page.getByTestId('month-total');

    // Income and what is left of it (D-021), and the donut (D-022).
    this.income = page.getByTestId('income-value');
    this.incomeEdit = page.getByTestId('income-edit');
    this.incomeInput = page.getByTestId('income-input');
    this.incomeSave = page.getByTestId('income-save');
    this.incomeCancel = page.getByTestId('income-cancel');
    this.remaining = page.getByTestId('month-remaining');
    // Reads 'Left' normally and 'Over' once the income is exceeded, so the
    // label is part of the answer rather than decoration around it.
    this.remainingLabel = page.getByTestId('remaining-label');
    this.donut = page.getByTestId('donut');
    this.slices = page.getByTestId(/^donut-slice-/);

    // A regular expression passed to getByTestId, so counting rows still goes
    // through the test-id API and no CSS attribute selector is needed.
    this.rows = page.getByTestId(/^tx-row-/);
    this.bars = page.getByTestId(/^category-bar-/);

    // Editing one expense (D-029).
    this.editAmount = page.getByTestId('tx-edit-amount');
    this.editCategory = page.getByTestId('tx-edit-category');
    this.editDate = page.getByTestId('tx-edit-date');
    this.editNote = page.getByTestId('tx-edit-note');
    this.editSave = page.getByTestId('tx-edit-save');
    this.editCancel = page.getByTestId('tx-edit-cancel');

    // The monthly spending limit and the state it produces
    // (qa/docs/analysis-monthly-limit.md).
    this.limit = page.getByTestId('limit-value');
    this.limitEdit = page.getByTestId('limit-edit');
    this.limitInput = page.getByTestId('limit-input');
    this.limitSave = page.getByTestId('limit-save');
    this.limitCancel = page.getByTestId('limit-cancel');
    // Reads "Within limit · €… left", "Limit reached" or "Over limit by €…",
    // so the state is in words and not only in colour (REQ-ML-09).
    this.limitStatus = page.getByTestId('limit-status');

    // Paging the month list (D-031).
    this.loadMore = page.getByTestId('tx-load-more');
    this.count = page.getByTestId('tx-count');
  }

  row(transactionId) {
    return this.page.getByTestId(`tx-row-${transactionId}`);
  }

  deleteButton(transactionId) {
    return this.page.getByTestId(`tx-delete-${transactionId}`);
  }

  /** The row's own body, which is the control that opens the editor. */
  editButton(transactionId) {
    return this.page.getByTestId(`tx-edit-${transactionId}`);
  }

  /** Open the editor on one row, change what is given, save. */
  async editExpense(transactionId, { amount, note, date } = {}) {
    await this.editButton(transactionId).click();
    if (amount !== undefined) await this.editAmount.fill(amount);
    if (note !== undefined) await this.editNote.fill(note);
    if (date !== undefined) await this.editDate.fill(date);
    await this.editSave.click();
  }

  bar(categoryId) {
    return this.page.getByTestId(`category-bar-${categoryId}`);
  }

  slice(categoryId) {
    return this.page.getByTestId(`donut-slice-${categoryId}`);
  }

  /** Open the limit editor, type a figure, save. An empty figure clears it. */
  async setLimit(amount) {
    await this.limitEdit.click();
    await this.limitInput.fill(amount);
    await this.limitSave.click();
  }

  /** Open the income editor, type a figure, save. */
  async setIncome(amount) {
    await this.incomeEdit.click();
    await this.incomeInput.fill(amount);
    await this.incomeSave.click();
  }
}

module.exports = { MonthPage };
