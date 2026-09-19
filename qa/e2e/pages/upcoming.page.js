'use strict';

const { BasePage } = require('./base.page');

/** Screen 6.3 — active schedules with a pay button on each. */
class UpcomingPage extends BasePage {
  constructor(page) {
    super(page);
    this.rows = page.getByTestId(/^schedule-row-/);
  }

  row(scheduleId) {
    return this.page.getByTestId(`schedule-row-${scheduleId}`);
  }

  nextDue(scheduleId) {
    return this.page.getByTestId(`schedule-next-due-${scheduleId}`);
  }

  remaining(scheduleId) {
    return this.page.getByTestId(`schedule-remaining-${scheduleId}`);
  }

  payButton(scheduleId) {
    return this.page.getByTestId(`schedule-pay-${scheduleId}`);
  }

  /** Appears only once a loan has been paid off. */
  finishedBadge(scheduleId) {
    return this.page.getByTestId(`schedule-finished-${scheduleId}`);
  }

  async pay(scheduleId) {
    await this.payButton(scheduleId).click();
  }
}

module.exports = { UpcomingPage };
