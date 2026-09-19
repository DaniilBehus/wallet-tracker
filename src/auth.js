'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const { db, seedCategories } = require('./db');
const { badRequest, unauthorized, conflict } = require('./validate');

const JWT_SECRET = process.env.JWT_SECRET;
const TOKEN_TTL = '30d';
const BCRYPT_ROUNDS = 10;
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Fail at boot, not at the first login. A server running with an undefined
// secret would sign tokens nobody can verify and report itself healthy.
if (!JWT_SECRET) {
  throw new Error(
    'JWT_SECRET is not set. Copy .env.example to .env and put a long random string in it.'
  );
}

// bcrypt is deliberately expensive — that is the security property and 10
// rounds stay 10 rounds. What changed (S12) is that the cost is no longer paid
// on the event loop: hash() and compare() hand the work to libuv's thread pool,
// so one login occupies a worker instead of the whole process.
//
// BUG-004 measured what the Sync forms cost: five concurrent allowed logins
// took GET /api/health from 1.5 ms to 422 ms at p95. The rate limiter capped
// how OFTEN that could be reached; only this removes the cost itself.
const signToken = (userId) =>
  jwt.sign({ sub: String(userId) }, JWT_SECRET, { algorithm: 'HS256', expiresIn: TOKEN_TTL });

async function register(email, password) {
  if (typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    throw badRequest('email must be a valid e-mail address');
  }
  if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`password must be at least ${MIN_PASSWORD_LENGTH} characters`);
  }

  const normalised = email.trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(normalised)) {
    throw conflict('An account with this e-mail already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const info = db
    .prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)')
    .run(normalised, passwordHash);

  const userId = Number(info.lastInsertRowid);
  seedCategories(userId);
  return signToken(userId);
}

async function login(email, password) {
  // One message for every failure mode. Saying "no such account" would confirm
  // which e-mail addresses are registered here.
  const rejected = unauthorized('E-mail or password is incorrect');

  if (typeof email !== 'string' || typeof password !== 'string') throw rejected;
  const user = db
    .prepare('SELECT id, password_hash FROM users WHERE email = ?')
    .get(email.trim().toLowerCase());
  if (!user) throw rejected;
  if (!(await bcrypt.compare(password, user.password_hash))) throw rejected;

  return signToken(user.id);
}

/** Bearer middleware. Sets req.userId, or fails with the standard 401 shape. */
function requireAuth(req, res, next) {
  const [scheme, token] = (req.get('authorization') || '').split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(unauthorized('Authorization header must be: Bearer <token>'));
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });
    req.userId = Number(payload.sub);
    next();
  } catch {
    next(unauthorized('Token is invalid or has expired'));
  }
}

module.exports = { register, login, requireAuth };
