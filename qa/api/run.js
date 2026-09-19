#!/usr/bin/env node
'use strict';

/*
 * Runs the Postman collection with newman.
 *
 *   npm run test:api
 *
 * It starts a server of its own — own port, own throwaway database, own
 * secret — runs the collection against it, and cleans up. Three things follow
 * from that, and all three were reasons to do it (D-017):
 *
 *   1. No manual step. There is nothing to start first and nothing to remember
 *      to stop, so the same command works locally and in CI.
 *   2. The collection stops writing into the database somebody is using. It
 *      creates two users and dozens of rows on every run.
 *   3. The rate-limit window can be made short, so the boundary in D-016 is
 *      testable without waiting fifteen minutes for it to lift.
 *
 * Set QA_BASE_URL to point at a server that is already running instead.
 *
 * It also mints a genuinely expired JWT. Tokens live 30 days (src/auth.js), so
 * an expired one cannot be obtained by waiting, and a random string would only
 * prove that garbage is rejected — not that expiry is checked. Signed with the
 * same secret the server was given, so the only thing wrong with it is its age.
 */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');
const newman = require('newman');
const jwt = require('jsonwebtoken');

const HERE = __dirname;
const ROOT = path.join(HERE, '..', '..');
const REPORT_DIR = path.join(ROOT, 'qa', 'reports');

// An externally supplied URL means "test that one, do not start anything".
const EXTERNAL_URL = process.env.QA_BASE_URL || null;
const PORT = Number(process.env.QA_PORT || 3001);
const BASE_URL = EXTERNAL_URL || `http://localhost:${PORT}`;
const DB_PATH = path.join(ROOT, 'data', `api-${Date.now()}.db`);

// Short enough for a test to sit out, long enough that the requests before it
// cannot drift past it on a slow machine. The collection waits this + a margin.
const LOGIN_WINDOW_MS = Number(process.env.LOGIN_WINDOW_MS || 4000);
const LOGIN_MAX_FAILURES = Number(process.env.LOGIN_MAX_FAILURES || 5);

const HEALTH_TIMEOUT_MS = 30000;
const HEALTH_INTERVAL_MS = 300;

const SECRET = process.env.JWT_SECRET || crypto.randomBytes(48).toString('hex');

function expiredToken() {
  const issued = Math.floor(Date.now() / 1000) - 60 * 60 * 24 * 40;   // 40 days ago
  return jwt.sign(
    { sub: '1', iat: issued, exp: issued + 60 * 60 * 24 * 30 },       // ended 10 days ago
    SECRET,
    { algorithm: 'HS256' }
  );
}

async function waitForServer() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastError = 'no attempt made';

  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err.message;
    }
    await new Promise((resolve) => setTimeout(resolve, HEALTH_INTERVAL_MS));
  }
  throw new Error(`the server at ${BASE_URL} never became healthy (${lastError})`);
}

function startServer() {
  const server = spawn(process.execPath, [path.join(ROOT, 'src', 'server.js')], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      DB_PATH,
      JWT_SECRET: SECRET,
      LOGIN_WINDOW_MS: String(LOGIN_WINDOW_MS),
      LOGIN_MAX_FAILURES: String(LOGIN_MAX_FAILURES),
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  server.on('error', (err) => {
    console.error(`could not start the server under test: ${err.message}`);
    process.exit(1);
  });
  return server;
}

/**
 * Housekeeping, and it runs at the START of a run — never at the end.
 *
 * This runner used to kill its server and delete its database the moment the
 * collection finished, and a run where all 340 assertions passed exited **127**
 * (BUG-008). CI reads that number and nothing else, so the first build would
 * have been red for a reason that had nothing to do with the application.
 *
 * The trigger is not the kill. Isolated: `fs.rmSync` on a better-sqlite3
 * database another process still has open **terminates this process inside the
 * call** — no exception, no return. Killing the child first does not help,
 * because the kill is asynchronous and the file is still held a moment later.
 *
 * So: sweep old `data/api-*.db` files on the way IN, where they cannot affect a
 * result that has not happened yet (Rule R8), and never delete this run's own.
 */
function sweepOldDatabases() {
  const dir = path.join(ROOT, 'data');
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    if (!name.startsWith('api-')) continue;
    try {
      fs.rmSync(path.join(dir, name), { force: true });
    } catch {
      /* still held by a process that has not finished dying */
    }
  }
}

function runNewman() {
  return new Promise((resolve) => {
    newman.run(
      {
        collection: path.join(HERE, 'wallet.postman_collection.json'),
        environment: path.join(HERE, 'wallet.postman_environment.json'),
        envVar: [{ key: 'baseUrl', value: BASE_URL }],
        globals: {
          values: [
            { key: 'tokenExpired', value: expiredToken(), type: 'any', enabled: true },
            // The collection needs to know where the boundary is; hard-coding 5
            // in fifty places is how a test suite stops matching its subject.
            { key: 'loginMaxFailures', value: String(LOGIN_MAX_FAILURES), type: 'any', enabled: true },
            { key: 'loginWindowMs', value: String(LOGIN_WINDOW_MS), type: 'any', enabled: true },
          ],
        },
        reporters: ['cli', 'htmlextra', 'junit'],
        reporter: {
          htmlextra: {
            export: path.join(REPORT_DIR, 'api-report.html'),
            title: 'WALLET · API checks',
            showEnvironmentData: false,   // the environment holds a bearer token
            skipSensitiveData: true,
          },
          junit: { export: path.join(REPORT_DIR, 'api-junit.xml') },
        },
        // Every request runs even after one fails: a run that stops at the
        // first failure reports one problem per run.
        bail: false,
      },
      (err, summary) => {
        if (err) {
          console.error(err);
          return resolve(1);
        }

        const { requests, assertions, testScripts } = summary.run.stats;
        console.log('');
        console.log(`requests   ${requests.total}  (${requests.failed} failed)`);
        console.log(`assertions ${assertions.total}  (${assertions.failed} failed)`);

        // Printed on its own line, always. A test script that throws before it
        // reaches its assertions contributes **nothing** to the numbers above,
        // so the run reads as "0 failed" while a request quietly checks nothing
        // at all. That is BUG-007: an apostrophe inside a single-quoted test
        // name turned the cross-user income check into a no-op, and the summary
        // said 337 assertions passed. Counting what did not run is the only way
        // that shows up.
        const scriptErrors = testScripts.failed;
        console.log(`scripts    ${testScripts.total}  (${scriptErrors} failed to run)`);
        if (scriptErrors > 0) {
          console.log('');
          console.log(`  ${scriptErrors} test script(s) did not execute. Their assertions are`);
          console.log('  missing from the count above, not passing.');
        }
        console.log(`report     ${path.relative(ROOT, path.join(REPORT_DIR, 'api-report.html'))}`);

        resolve(assertions.failed > 0 || summary.run.failures.length > 0 ? 1 : 0);
      }
    );
  });
}

async function main() {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  sweepOldDatabases();

  const server = EXTERNAL_URL ? null : startServer();

  // Whether the child is already gone, tracked from the moment it is spawned.
  // `server.killed` only says whether a signal was *sent*, which is not the
  // same question and answers `false` for a child that died on its own.
  let serverGone = false;
  if (server) server.once('exit', () => { serverGone = true; });

  let code = 1;

  try {
    await waitForServer();
    if (!EXTERNAL_URL) {
      console.log(
        `server under test: ${BASE_URL}  ` +
          `(db: ${path.relative(ROOT, DB_PATH)}, login window: ${LOGIN_WINDOW_MS} ms)\n`
      );
    }
    code = await runNewman();
  } catch (err) {
    console.error(err.message);
    code = 1;
  }

  // The result is recorded BEFORE any cleanup, and nothing after this line may
  // change it. That is R8, and it is here because the previous version broke it
  // in the opposite direction to BUG-008: the exit code was assigned *after* an
  // await that could never resolve, so a run where the server never started
  // exited 0 and CI called it green (BUG-010).
  process.exitCode = code;

  // Stop the server and wait for it to actually be gone. Three things have to
  // be true at once: the child must die (or it outlives the run holding port
  // 3001), the process must end by itself (a live child keeps the event loop
  // referenced, so main() would otherwise hang), and the exit code must survive
  // (`process.exit()` truncates buffered stdout — it ate the whole summary and
  // the HTML report when it was tried).
  //
  // Nothing is deleted here. That is what killed the process at 127 (BUG-008).
  if (server && !serverGone) {
    await new Promise((resolve) => {
      server.once('exit', resolve);
      // A child that ignores SIGTERM must not hold the run open for ever. The
      // exit code is already set, so giving up here costs nothing but a stray
      // process, and reporting the wrong result would cost the whole run.
      const giveUp = setTimeout(() => {
        console.error('the server under test did not exit within 5s; leaving it');
        resolve();
      }, 5000);
      giveUp.unref();
      server.kill();
    });
  }
}

main();
