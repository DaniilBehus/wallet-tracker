'use strict';

/**
 * What every screen has: the bottom navigation and the two toasts.
 *
 * Locators live in page objects and nowhere else — a spec that builds its own
 * locator is a spec that has to be found and edited when the markup changes.
 * Only getByTestId and getByRole are used; there is not a CSS selector in this
 * directory.
 */
class BasePage {
  constructor(page) {
    this.page = page;

    this.toastSuccess = page.getByTestId('toast-success');
    this.toastError = page.getByTestId('toast-error');

    this.navAdd = page.getByTestId('nav-add');
    this.navMonth = page.getByTestId('nav-month');
    this.navUpcoming = page.getByTestId('nav-upcoming');
    this.navSchedules = page.getByTestId('nav-schedules');
  }

  /** Open the app with a session already established. */
  async open() {
    await this.page.goto('/');
  }

  async goToAdd() { await this.navAdd.click(); }
  async goToMonth() { await this.navMonth.click(); }
  async goToUpcoming() { await this.navUpcoming.click(); }
  async goToSchedules() { await this.navSchedules.click(); }
}

module.exports = { BasePage };
