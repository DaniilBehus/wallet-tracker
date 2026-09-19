'use strict';

const { BasePage } = require('./base.page');

/** The sign-in / registration screen. */
class AuthPage extends BasePage {
  constructor(page) {
    super(page);

    this.email = page.getByTestId('auth-email');
    this.password = page.getByTestId('auth-password');
    this.submit = page.getByTestId('auth-submit');
    this.toggleMode = page.getByTestId('auth-toggle');
  }

  async register(email, password) {
    await this.toggleMode.click();
    await this.fillAndSubmit(email, password);
  }

  async signIn(email, password) {
    await this.fillAndSubmit(email, password);
  }

  async fillAndSubmit(email, password) {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}

module.exports = { AuthPage };
