'use strict';

const { BasePage } = require('./base.page');

/** Screen 6.4 — the form, whose only branch is the "Je to pôžička" checkbox. */
class SchedulesPage extends BasePage {
  constructor(page) {
    super(page);

    this.name = page.getByTestId('schedule-name');
    this.amount = page.getByTestId('schedule-amount');
    this.category = page.getByTestId('schedule-category');
    this.day = page.getByTestId('schedule-day');
    this.dayHint = page.getByTestId('schedule-day-hint');
    this.startsOn = page.getByTestId('schedule-starts-on');
    this.isLoan = page.getByTestId('schedule-is-loan');
    this.totalCount = page.getByTestId('schedule-total-count');
    this.save = page.getByTestId('schedule-save-btn');

    this.rows = page.getByTestId(/^schedule-row-/);
  }

  row(scheduleId) {
    return this.page.getByTestId(`schedule-row-${scheduleId}`);
  }

  remaining(scheduleId) {
    return this.page.getByTestId(`schedule-remaining-${scheduleId}`);
  }

  /**
   * Fill and submit the form.
   * `totalCount` omitted means a subscription; a number means a loan, and the
   * checkbox is ticked to reveal the field the way a person would.
   */
  async create({ name, amount, day, startsOn, totalCount }) {
    await this.name.fill(name);
    await this.amount.fill(amount);
    await this.day.fill(String(day));
    await this.startsOn.fill(startsOn);

    if (totalCount !== undefined) {
      await this.isLoan.check();
      await this.totalCount.fill(String(totalCount));
    }

    await this.save.click();
  }
}

module.exports = { SchedulesPage };
