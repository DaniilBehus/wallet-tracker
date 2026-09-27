'use strict';

// A request id on every response, and one JSON line per request.
//
// The id is what a person reads off an error message ("Reference: 1a2b3c4d")
// and what support searches the log for. It is generated here, or taken from
// the caller's X-Request-Id only when that is exactly a lowercase UUID: a value
// that is logged and echoed back is a value an attacker would like to choose,
// so anything else — longer, shorter, other characters, other case — is
// replaced rather than cleaned up. A UUID also keeps the AI draft's request_id
// what spec/ai-expense-entry.md promises it is.
//
// What the line never carries: an e-mail, a password, a token or the
// Authorization header, a note, an AI description or answer, a request body, a
// raw URL. The route is logged as its pattern (/api/transactions/:id), so an id
// or a query string never reaches the log either.

const crypto = require('crypto');

const SAFE_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// WALLET_REQUEST_LOG=off keeps a test run's output quiet. It silences the
// per-request lines only: an unhandled error is always written.
const requestLinesOn = () => process.env.WALLET_REQUEST_LOG !== 'off';

/**
 * The route that answered, as a pattern.
 *
 * Express 5 restores req.baseUrl when an error leaves a router, so by the time
 * the response closes the mount path is gone from it; rememberMount keeps a
 * copy. A request refused before any route matched (a missing token, say) is
 * reported as its mount with /*, and one that matched nothing at all as null.
 */
function routeOf(req) {
  if (req.route && typeof req.route.path === 'string') {
    // A router's own root reads as its mount: /api/transactions, not .../.
    const tail = req.mountPath && req.route.path === '/' ? '' : req.route.path;
    return (req.mountPath || '') + tail;
  }
  return req.mountPath ? `${req.mountPath}/*` : null;
}

/** Mounted in front of a router, so its path survives an error (see routeOf). */
function rememberMount(req, res, next) {
  req.mountPath = req.baseUrl;
  next();
}

/** First in the stack: nothing may answer before the id exists. */
function requestContext(req, res, next) {
  const incoming = req.get('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : crypto.randomUUID();
  res.set('X-Request-Id', req.id);

  if (requestLinesOn()) {
    const started = process.hrtime.bigint();
    // 'close' rather than 'finish': it also fires when the client gives up
    // first, and a request nobody waited for is worth a line too.
    res.on('close', () => {
      const line = {
        time: new Date().toISOString(),
        level: 'info',
        event: 'request',
        request_id: req.id,
        method: req.method,
        route: routeOf(req),
        status: res.statusCode,
        duration_ms: Math.round(Number(process.hrtime.bigint() - started) / 1e5) / 10,
        user_id: req.userId === undefined ? null : req.userId,
      };
      if (!res.writableFinished) line.aborted = true;
      process.stdout.write(JSON.stringify(line) + '\n');
    });
  }
  next();
}

/**
 * An error the app did not expect, with the request it broke. The message and
 * the stack only: never err.body, which body-parser fills with the raw request.
 * "UNHANDLED" stays the event name — a test looks for that word to prove no
 * provider error ever reaches this path.
 */
function logUnhandled(req, err) {
  process.stderr.write(JSON.stringify({
    time: new Date().toISOString(),
    level: 'error',
    event: 'UNHANDLED',
    request_id: req.id,
    method: req.method,
    route: routeOf(req),
    code: err && err.code ? String(err.code) : null,
    message: err && err.message ? String(err.message) : String(err),
    stack: err && err.stack ? String(err.stack) : null,
  }) + '\n');
}

module.exports = { requestContext, rememberMount, logUnhandled, routeOf, SAFE_ID };
