'use strict';

const path = require('path');
const express = require('express');

const { db } = require('./db');
const { register, login, requireAuth } = require('./auth');
const { ApiError, badRequest, notFound } = require('./validate');
const rateLimit = require('./ratelimit');

const PORT = Number(process.env.PORT) || 3000;
const VERSION = '1.0.0';

const app = express();
// `verify` records how many bytes the JSON body had, so a route with a tighter
// limit than the global parser (the AI draft route, 8 KiB) can refuse a large
// body without re-serialising it. The global limit itself is unchanged.
app.use(express.json({
  verify: (req, res, buf) => { req.rawBodyBytes = buf.length; },
}));

// --------------------------------------------------------------------- public

// No auth, and it must not touch user data (spec §5).
app.get('/api/health', (req, res) => {
  let dbState = 'ok';
  try {
    db.prepare('SELECT 1').get();
  } catch {
    dbState = 'error';
  }
  res.status(200).json({ status: 'ok', version: VERSION, db: dbState });
});

// Express 5 forwards a rejected promise to the error handler on its own, so
// there is no try/catch here and the single error renderer below still sees
// everything (spec §5).
app.post('/api/auth/register', async (req, res) => {
  const body = req.body || {};
  res.status(201).json({ token: await register(body.email, body.password) });
});

app.post('/api/auth/login', async (req, res) => {
  const body = req.body || {};
  const email = body.email;

  // Before bcrypt, deliberately — the cost of hashing is what BUG-004 was
  // about, so a limiter that ran after it would protect nothing (D-016).
  rateLimit.check(email, req.ip);

  try {
    const token = await login(email, body.password);
    rateLimit.clear(email, req.ip);
    res.status(200).json({ token });
  } catch (err) {
    // Only a rejected credential counts. A malformed request is somebody's
    // broken client, not a guess, and locking them out would be noise.
    if (err instanceof ApiError && err.status === 401) {
      rateLimit.recordFailure(email, req.ip);
    }
    throw err;
  }
});

// ------------------------------------------------------------------ protected

app.use('/api/categories', requireAuth, require('./routes/categories'));
app.use('/api/transactions', requireAuth, require('./routes/transactions'));
app.use('/api/schedules', requireAuth, require('./routes/schedules'));
app.use('/api/summary', requireAuth, require('./routes/summary'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/ai', requireAuth, require('./routes/ai'));

// The app itself. Declared after the API so that no static file can ever
// shadow an endpoint.
app.use(express.static(path.join(__dirname, '..', 'public')));

// An unknown /api path is a 404 in the standard error shape, not Express's
// default HTML page — a client parsing JSON should never receive markup.
app.use('/api', (req, res, next) =>
  next(notFound(`No such endpoint: ${req.method} ${req.originalUrl}`))
);

// ---------------------------------------------------------------------- error

// The single place an error body is written. Everything upstream throws.
app.use((err, req, res, next) => {
  // A malformed JSON body is rejected by express.json() before any handler
  // runs. Left alone it would surface as a 500, and spec §5 says a 500 must
  // never be reachable through the UI.
  if (err && err.type === 'entity.parse.failed') {
    err = badRequest('Request body is not valid JSON');
  }
  // BUG-019: an oversized body used to fall through to the 500 below and be
  // logged whole as UNHANDLED. It is the client's request that is too large,
  // and mapping it here also keeps the body out of the log.
  if (err && err.type === 'entity.too.large') {
    err = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if (err instanceof ApiError) {
    // A 429 that does not say when to come back is a 429 the client has to
    // guess about (spec §5, D-016).
    if (err.retryAfter) res.set('Retry-After', String(err.retryAfter));
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  // Anything reaching here is a bug in this app, so log it whole rather than
  // swallowing it — the response stays deliberately vague.
  console.error('UNHANDLED', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Unexpected server error' },
  });
});

app.listen(PORT, () => {
  console.log(`wallet ${VERSION} listening on http://localhost:${PORT}`);
});

module.exports = app;
