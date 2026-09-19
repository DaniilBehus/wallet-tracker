'use strict';

// The one error class every handler throws and the single renderer in
// server.js turns into `{ error: { code, message } }` (spec §5).
//
// It lives in its own module, apart from validate.js, for one reason found in
// S23: validate.js opens the database when it is required. The AI contract and
// normaliser are pure and are unit-tested without a server; importing the error
// class through validate.js would have made a "pure" unit test open
// DB_PATH — by default the owner's data/wallet.db. A class has no business
// carrying a database connection with it.

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

module.exports = { ApiError };
