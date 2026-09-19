'use strict';

const { BasePage } = require('./base.page');

/** Screen 6.1 — the default screen: amount, categories, keypad, save. */
class AddPage extends BasePage {
  constructor(page) {
    super(page);

    this.amount = page.getByTestId('amount-display');
    this.clear = page.getByTestId('keypad-clear');
    this.save = page.getByTestId('expense-save-btn');
    this.note = page.getByTestId('expense-note');
    // The scrolling list itself, for layout checks (BUG-014).
    this.categories = page.getByRole('group', { name: 'Categories' });
  }

  /** One key of the on-screen keypad. */
  key(digit) {
    return this.page.getByTestId(`keypad-${digit}`);
  }

  /**
   * A category tile, addressed by the name a person reads on it.
   * By role and accessible name rather than by id, so this asserts the tile is
   * reachable the way a user reaches it — a tile with no name would fail here.
   */
  tile(categoryName) {
    return this.page.getByRole('button', { name: categoryName, exact: true });
  }

  tileById(categoryId) {
    return this.page.getByTestId(`category-tile-${categoryId}`);
  }

  /** Type an amount as cents: '1250' produces 12,50 €. */
  async enterAmount(cents) {
    for (const digit of String(cents)) {
      await this.key(digit).click();
    }
  }

  /**
   * The whole flow spec §8 calls "two taps and a save".
   * `note` is optional and stays optional here, so the two-tap path is still
   * expressed as two taps (D-020).
   */
  async addExpense(cents, categoryName, note) {
    await this.enterAmount(cents);
    await this.tile(categoryName).click();
    if (note !== undefined) await this.note.fill(note);
    await this.save.click();
  }
}

module.exports = { AddPage };
