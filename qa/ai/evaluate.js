#!/usr/bin/env node
'use strict';

/*
 * Extraction evaluator for AI expense drafts (plan §15, spec/ai-expense-entry.md).
 *
 *   npm run eval:ai                         fixture mode, offline, the default
 *   npm run eval:ai:live -- --dry-run       validate corpus + config, zero calls
 *   npm run eval:ai:live -- --limit N       real provider, only when configured
 *
 * ---------------------------------------------------------------------------
 * What each mode measures, and what it does not.
 *
 * FIXTURE  Every row's `fixture_output` plays the model. The rows go through
 *          the production draft service — request contract, category refs,
 *          quota reservation, provider-output contract, deterministic
 *          normalisation — on a throwaway database, with the clock set to the
 *          row's reference date. A failure here is a normaliser defect or a
 *          label defect. It says NOTHING about how well a model extracts:
 *          MODEL_QUALITY=NOT_MEASURED is printed on every fixture report.
 *
 * LIVE     The same service, with the real OpenAI adapter answering. Calls go
 *          through the production limiter with the real clock, against a
 *          finite evaluation allowance of its own (WALLET_AI_EVAL_DAILY_CALLS,
 *          1–200 per day) kept in data/ai-eval.db — never by raising the app's
 *          pilot limits, which the same .env also feeds to `npm start` (D-038).
 *          The evaluation database must be a different FILE from every
 *          application database, however spelled: junctions, symlinks, hard
 *          links and SQLite companions included (db-identity.js, N1). Synthetic
 *          users are stable across runs, so per-user counters persist.
 *          One split per live run (`--split all` is refused); whenever the
 *          planned rows contain a holdout row, one atomic ledger reservation is
 *          made before any dispatch and a repeat needs --rerun-holdout
 *          "<reason>" (holdout-ledger.js, N2, D-039). It refuses to start unless
 *          WALLET_AI_EVAL_LIVE=true, every live prerequisite, the allowance and
 *          --limit N are present; otherwise LIVE NOT RUN, exit 3. `--dry-run`
 *          loads the network guard first, sends nothing and writes nothing; it
 *          reads an existing evaluation database read-only for today's count.
 *
 * Every report names its code by content (provenance.js, N3): a manifest of
 * file hashes taken at the start and at the end of the run, Git only as
 * supplemental context. Scope and verdict say whether a live run was a pilot,
 * a full dev split or a full holdout split (report.js, N4).
 *
 * ---------------------------------------------------------------------------
 * Why the evaluator can fail.
 *
 *   * The corpus is checked against its frozen manifest (hash, row counts,
 *     holdout ids) before anything runs. A missing or edited row refuses.
 *   * Every denominator must be non-zero. A run that scored nothing cannot pass.
 *   * A refusal is scored against the label, not as "safe therefore correct":
 *     an unsupported answer to a ready row fails amount, date, category and
 *     coverage.
 *   * Guard rejections of a wrong model answer count as extraction failures.
 *
 * Reports go to qa/reports/ai-eval/ (git-ignored). They contain case ids,
 * expected and actual values and codes — never descriptions, prompts, keys or
 * provider bodies.
 */

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { buildManifest, compareManifests, gitSupplement } = require('./provenance');
const { assertDistinctDatabase, protectedDatabasePaths } = require('./db-identity');
const { holdoutIdentity, reserveHoldout, finishHoldout } = require('./holdout-ledger');
const { EVAL_WINDOW, ensureWindowTable, readWindowState, reserveCall, availabilityText } = require('./eval-window');

const WINDOW_TEXT = `${EVAL_WINDOW.calls} provider calls per rolling ${EVAL_WINDOW.ms / 60000} minutes`;

/**
 * The evaluator's fixed per-minute and concurrency limits for src/ai/limits.js.
 * The application's WALLET_AI_USER_MINUTE_CALLS and WALLET_AI_MAX_CONCURRENT do
 * not apply here.
 *
 * The minute allowance is deliberately non-binding (100, the ceiling the
 * application's own setting accepts): the pacing is the rolling window (5 per
 * 10 minutes) and the daily allowance. A minute allowance equal to the window
 * is not enough — the minute counter lives in the shared evaluation database and
 * is checked before the window, so parallel runs could be refused, and made to
 * wait up to 60 s, by it instead of by the window. Rows run one at a time, so one
 * concurrency slot is enough.
 */
const EVAL_FIXED_LIMITS = Object.freeze({ userMinute: 100, maxConcurrent: 1, perUserConcurrent: 1 });
const { markdownReport, qualityVerdict, pct, httpErrorLine } = require('./report');
const { isGuardActive } = require('./support/network-guard-state');

const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_CORPUS = path.join(__dirname, 'data', 'eval-cases.jsonl');
const DEFAULT_MANIFEST = path.join(__dirname, 'data', 'manifest.json');
const REPORT_DIR = path.join(ROOT, 'qa', 'reports', 'ai-eval');
const DEFAULT_EVAL_DB = path.join(ROOT, 'data', 'ai-eval.db');
const MAX_EVAL_DAILY_CALLS = 200;

const STATUSES = ['ready', 'needs_input', 'unsupported'];
const ROW_KEYS = ['id', 'split', 'kind', 'language', 'tags', 'text', 'reference_date', 'categories', 'fixture_output', 'expected', 'rationale', 'label_provenance'];
const EXPECTED_KEYS = ['status', 'amount_cents', 'category_names', 'spent_on', 'issues_include'];
const MIN_NL_ROWS = 80;

// Initial acceptance targets chosen for this project (plan §15), not benchmarks.
const THRESHOLDS = {
  complete_draft_rate: 0.90,
  amount_accuracy: 0.98,
  date_accuracy: 0.98,
  category_accuracy: 0.90,
  false_ready: 0,
  invented_numeric_fields: 0,
  // R5 (review 2026-09-15): a confident wrong number is worse than a missing
  // one, and 59/60 still clears a 98% accuracy target. Zero tolerated.
  wrong_numeric_fields: 0,
};

class CorpusError extends Error {
  constructor(problems) {
    super(`corpus refused:\n  - ${problems.join('\n  - ')}`);
    this.name = 'CorpusError';
    this.problems = problems;
  }
}

// ------------------------------------------------------------------ corpus

/**
 * Reads and verifies the corpus against its manifest. Throws CorpusError with
 * every problem found, not only the first.
 */
function loadCorpus({ corpusPath = DEFAULT_CORPUS, manifestPath = DEFAULT_MANIFEST } = {}) {
  const problems = [];
  if (!fs.existsSync(corpusPath)) throw new CorpusError([`corpus file not found: ${path.basename(corpusPath)}`]);
  if (!fs.existsSync(manifestPath)) throw new CorpusError([`manifest not found: ${path.basename(manifestPath)}`]);

  const bytes = fs.readFileSync(corpusPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== manifest.sha256) problems.push(`sha256 ${sha256.slice(0, 12)}… does not match manifest ${String(manifest.sha256).slice(0, 12)}…`);

  const lines = bytes.toString('utf8').split('\n').filter((l) => l.trim() !== '');
  const rows = [];
  lines.forEach((line, i) => {
    try { rows.push(JSON.parse(line)); } catch { problems.push(`line ${i + 1} is not JSON`); }
  });

  if (rows.length === 0) problems.push('corpus has no rows');
  if (rows.length !== manifest.total_rows) problems.push(`total rows ${rows.length}, manifest says ${manifest.total_rows}`);

  const ids = new Set();
  for (const row of rows) {
    const label = row && row.id ? row.id : '(no id)';
    for (const key of ROW_KEYS) if (!(key in row)) problems.push(`${label}: missing ${key}`);
    if (ids.has(row.id)) problems.push(`${label}: duplicate id`);
    ids.add(row.id);
    const exp = row.expected || {};
    for (const key of EXPECTED_KEYS) if (!(key in exp)) problems.push(`${label}: expected.${key} missing`);
    if (!STATUSES.includes(exp.status)) problems.push(`${label}: expected.status ${JSON.stringify(exp.status)}`);
    if (exp.category_names !== null && exp.category_names !== undefined
      && (!Array.isArray(exp.category_names) || exp.category_names.length === 0)) {
      problems.push(`${label}: expected.category_names must be null or a non-empty list`);
    }
    if (!Array.isArray(exp.issues_include)) problems.push(`${label}: expected.issues_include must be a list`);
    if (!row.fixture_output || typeof row.fixture_output !== 'object') problems.push(`${label}: fixture_output missing`);
  }

  const nl = rows.filter((r) => r.kind === 'nl');
  if (nl.length !== manifest.nl_rows) problems.push(`NL rows ${nl.length}, manifest says ${manifest.nl_rows}`);
  if (nl.length < MIN_NL_ROWS) problems.push(`NL rows ${nl.length} < required ${MIN_NL_ROWS}`);
  for (const split of Object.keys(manifest.nl_by_split || {})) {
    const count = nl.filter((r) => r.split === split).length;
    if (count !== manifest.nl_by_split[split]) problems.push(`split ${split}: ${count} rows, manifest says ${manifest.nl_by_split[split]}`);
  }
  const holdout = rows.filter((r) => r.split === 'holdout').map((r) => r.id).sort();
  const frozen = [...(manifest.holdout_ids || [])].sort();
  if (JSON.stringify(holdout) !== JSON.stringify(frozen)) problems.push('holdout ids differ from the frozen manifest list');

  if (problems.length > 0) throw new CorpusError(problems);
  return { rows, manifest, sha256 };
}

// ----------------------------------------------------------------- scoring

/**
 * @param row     corpus row
 * @param actual  { kind: 'draft', status, amount_cents, category_name, spent_on, issues[] }
 *                | { kind: 'error', code, http_status? }
 */
function scoreCase(row, actual) {
  const exp = row.expected;
  const isDraft = actual.kind === 'draft';
  const got = isDraft ? actual : { status: null, amount_cents: null, category_name: null, spent_on: null, issues: [] };

  const checks = {
    status: got.status === exp.status,
    amount: got.amount_cents === exp.amount_cents,
    date: got.spent_on === exp.spent_on,
    category: exp.category_names === null ? got.category_name === null : exp.category_names.includes(got.category_name),
    issues: exp.issues_include.every((code) => got.issues.includes(code)),
  };
  return {
    id: row.id,
    split: row.split,
    kind: row.kind,
    language: row.language,
    pass: isDraft && Object.values(checks).every(Boolean),
    checks,
    error_code: isDraft ? null : actual.code,
    false_ready: got.status === 'ready' && exp.status !== 'ready',
    invented: {
      amount: exp.amount_cents === null && got.amount_cents !== null,
      date: exp.spent_on === null && got.spent_on !== null,
      category: exp.category_names === null && got.category_name !== null,
    },
    wrong: {
      amount: exp.amount_cents !== null && got.amount_cents !== null && got.amount_cents !== exp.amount_cents,
      date: exp.spent_on !== null && got.spent_on !== null && got.spent_on !== exp.spent_on,
    },
    expected: { status: exp.status, amount_cents: exp.amount_cents, category_names: exp.category_names, spent_on: exp.spent_on, issues_include: exp.issues_include },
    actual: isDraft
      ? { status: got.status, amount_cents: got.amount_cents, category_name: got.category_name, spent_on: got.spent_on, issues: got.issues }
      : { error: actual.code, ...(isHttpStatus(actual.http_status) ? { http_status: actual.http_status } : {}) },
  };
}

const isHttpStatus = (n) => Number.isInteger(n) && n >= 100 && n <= 599;

/** D-042: the numeric HTTP status a provider error kept, or null. Nothing else is read from it. */
const httpStatusOf = (err) => (err && isHttpStatus(err.httpStatus) ? err.httpStatus : null);

/** { "400": 1, "503": 2 } over the scored rows that ended in a non-2xx provider answer. */
function httpErrorStatuses(scored) {
  const counts = {};
  for (const s of scored) {
    const status = s.actual && s.actual.http_status;
    if (isHttpStatus(status)) counts[status] = (counts[status] || 0) + 1;
  }
  return counts;
}

const ratio = (num, den) => ({ num, den, value: den === 0 ? null : num / den });

function measure(scored) {
  const count = (pred) => scored.filter(pred).length;
  const applicable = (field) => scored.filter((s) => s.expected[field] !== null);
  const readyRows = scored.filter((s) => s.expected.status === 'ready');
  return {
    rows: scored.length,
    row_pass: ratio(count((s) => s.pass), scored.length),
    status_accuracy: ratio(count((s) => s.checks.status), scored.length),
    amount_accuracy: ratio(applicable('amount_cents').filter((s) => s.checks.amount).length, applicable('amount_cents').length),
    date_accuracy: ratio(applicable('spent_on').filter((s) => s.checks.date).length, applicable('spent_on').length),
    category_accuracy: ratio(applicable('category_names').filter((s) => s.checks.category).length, applicable('category_names').length),
    complete_draft_rate: ratio(readyRows.filter((s) => s.pass).length, readyRows.length),
    coverage: ratio(readyRows.filter((s) => s.actual.status === 'ready').length, readyRows.length),
    issue_recall: ratio(count((s) => s.checks.issues), scored.length),
    false_ready: count((s) => s.false_ready),
    invented_numeric_fields: count((s) => s.invented.amount || s.invented.date),
    wrong_numeric_fields: count((s) => s.wrong.amount || s.wrong.date),
    invented_category: count((s) => s.invented.category),
    errors: count((s) => s.error_code !== null),
  };
}

function groupBy(scored, key) {
  const out = {};
  for (const value of [...new Set(scored.map((s) => s[key]))].sort()) {
    out[value] = measure(scored.filter((s) => s[key] === value));
  }
  return out;
}

function summarize(scored) {
  const supported = scored.filter((s) => s.kind === 'nl');
  const exploratory = scored.filter((s) => s.kind !== 'nl');
  return {
    supported: measure(supported),
    by_split: groupBy(supported, 'split'),
    by_language: groupBy(supported, 'language'),
    exploratory: { rows: exploratory.length, row_pass: ratio(exploratory.filter((s) => s.pass).length, exploratory.length) },
  };
}

/**
 * @param summary   from summarize()
 * @param opts.expectedRows   how many supported rows were selected to run
 * @param opts.requireAllPass fixture mode: every row must match its label
 * @returns {{ok: boolean, failures: string[]}}
 */
function checkThresholds(summary, { expectedRows, requireAllPass = false } = {}) {
  const failures = [];
  const s = summary.supported;
  if (s.rows === 0) failures.push('no supported rows were scored');
  if (expectedRows !== undefined && s.rows !== expectedRows) failures.push(`scored ${s.rows} supported rows, selected ${expectedRows}`);
  for (const metric of ['complete_draft_rate', 'amount_accuracy', 'date_accuracy', 'category_accuracy']) {
    const r = s[metric];
    if (r.den === 0) failures.push(`${metric}: empty denominator`);
    else if (r.value < THRESHOLDS[metric]) failures.push(`${metric} ${r.num}/${r.den} below ${THRESHOLDS[metric]}`);
  }
  if (s.false_ready > THRESHOLDS.false_ready) failures.push(`false_ready ${s.false_ready}`);
  if (s.invented_numeric_fields > THRESHOLDS.invented_numeric_fields) failures.push(`invented_numeric_fields ${s.invented_numeric_fields}`);
  if (s.wrong_numeric_fields > THRESHOLDS.wrong_numeric_fields) failures.push(`wrong_numeric_fields ${s.wrong_numeric_fields} (a non-null amount or date that differs from the label)`);
  if (requireAllPass && s.row_pass.num !== s.row_pass.den) failures.push(`fixture consistency ${s.row_pass.num}/${s.row_pass.den} rows match their labels`);
  return { ok: failures.length === 0, failures };
}

// --------------------------------------------------------------- execution

/**
 * Loads the production modules against a database file of our choosing.
 * src/db.js opens DB_PATH on first require, so the variable is set before.
 */
function loadApp(dbPath) {
  if (require.cache[require.resolve(path.join(ROOT, 'src', 'db.js'))]) {
    throw new Error('src/db.js was already loaded; the evaluator must choose the database first');
  }
  process.env.DB_PATH = dbPath;
  return {
    ...require(path.join(ROOT, 'src', 'db.js')),
    service: require(path.join(ROOT, 'src', 'ai', 'service.js')),
    limitsModule: require(path.join(ROOT, 'src', 'ai', 'limits.js')),
    contract: require(path.join(ROOT, 'src', 'ai', 'contract.js')),
    prompt: require(path.join(ROOT, 'src', 'ai', 'prompt.js')),
    config: require(path.join(ROOT, 'src', 'ai', 'config.js')),
    openai: require(path.join(ROOT, 'src', 'ai', 'openai.js')),
  };
}

/** A synthetic user per distinct category set; returns id and id->name map. */
function userFactory(app) {
  const cache = new Map();
  const insertUser = app.db.prepare('INSERT INTO users (email, password_hash) VALUES (?, ?)');
  const findUser = app.db.prepare('SELECT id FROM users WHERE email = ?');
  const insertCategory = app.db.prepare('INSERT INTO categories (user_id, name, icon) VALUES (?, ?, NULL)');
  const readCategories = app.db.prepare('SELECT id, name FROM categories WHERE user_id = ?');
  return function userFor(categories) {
    const key = JSON.stringify(categories);
    if (cache.has(key)) return cache.get(key);
    // L2: one stable synthetic user per category set. A new user per run
    // would reset every per-user counter the limiter keeps.
    const email = `eval-${crypto.createHash('sha256').update(key).digest('hex').slice(0, 16)}@wallet.test`;
    const existing = findUser.get(email);
    let userId;
    if (existing) {
      userId = existing.id;
    } else {
      userId = Number(insertUser.run(email, 'not-a-login').lastInsertRowid);
      if (categories === 'default') app.seedCategories(userId);
      else for (const name of categories) insertCategory.run(userId, name);
    }
    const names = new Map(readCategories.all(userId).map((c) => [c.id, c.name]));
    const user = { userId, names };
    cache.set(key, user);
    return user;
  };
}

/**
 * What to do when the limiter refuses a row. A refusal happens before any
 * provider call, so waiting costs nothing; it is not a retry of a request.
 * Minute and concurrency limits (Retry-After ≤ 60 s) are waited out once per
 * row; a daily limit, or a second refusal for the same row, ends the run.
 */
function rateLimitDecision(err, { waitedForThisRow }) {
  if (!err || err.code !== 'AI_RATE_LIMITED') return null;
  const seconds = Number(err.retryAfter) || 0;
  if (!waitedForThisRow && seconds > 0 && seconds <= 60) return { action: 'wait', seconds };
  return { action: 'stop', seconds };
}

const noonOf = (isoDay) => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
};

async function runRows(app, rows, { provider, limitsFor, onRow, sleep = null, httpStatusFor = null }) {
  const userFor = userFactory(app);
  const scored = [];
  const latencies = [];
  const usage = { input_tokens: 0, output_tokens: 0, reasoning_tokens: 0, calls_with_usage: 0, calls_with_reasoning: 0, unusable_with_usage: 0 };
  let stoppedBy = null;

  for (let index = 0, waited = false; index < rows.length; index++) {
    const row = rows[index];
    const user = userFor(row.categories);
    const rowClock = { now: () => noonOf(row.reference_date) };
    const logged = [];
    const service = app.service.createDraftService({
      db: app.db,
      getProvider: () => provider(row),
      limits: limitsFor(rowClock),
      clock: rowClock,
      log: (entry) => logged.push(entry),
    });
    const body = { text: row.text, reference_date: row.reference_date, locale: 'auto', consent_to_external_processing: true };

    let actual;
    let refusal = null;
    try {
      const result = await service.createDraft({ userId: user.userId, body, rawBytes: Buffer.byteLength(JSON.stringify(body)) });
      actual = {
        kind: 'draft',
        status: result.status,
        amount_cents: result.draft.amount_cents,
        category_name: result.draft.category_id === null ? null : (user.names.get(result.draft.category_id) || `FOREIGN:${result.draft.category_id}`),
        spent_on: result.draft.spent_on,
        issues: result.issues.map((i) => i.code),
      };
    } catch (err) {
      // The service turns a provider error into a generic ApiError; a numeric
      // HTTP status, if the provider answer had one, comes from the live
      // runner's own record of that call (D-042).
      actual = { kind: 'error', code: err.code || err.name || 'ERROR', http_status: httpStatusFor ? httpStatusFor(row) : null };
      refusal = err;
    }
    // D-043: the rolling window refused this row's call before its request.
    // The row is not scored and the run ends; nothing waits for the window.
    if (refusal && refusal.code === 'EVAL_WINDOW_FULL') {
      stoppedBy = `EVAL_WINDOW_FULL at ${row.id}: ${WINDOW_TEXT} reached; next call available ${availabilityText(refusal.availableAtMs)}`;
      break;
    }
    for (const entry of logged) {
      latencies.push(entry.ms);
      if (entry.usage) {
        usage.input_tokens += entry.usage.input_tokens || 0;
        usage.output_tokens += entry.usage.output_tokens || 0;
        usage.calls_with_usage += 1;
        if (Number.isInteger(entry.usage.reasoning_tokens)) {
          usage.reasoning_tokens += entry.usage.reasoning_tokens;
          usage.calls_with_reasoning += 1;
        }
        // Reported usage on an answer that produced no draft: billed, unusable.
        if (!STATUSES.includes(entry.outcome)) usage.unusable_with_usage += 1;
      }
    }
    const decision = rateLimitDecision(refusal, { waitedForThisRow: waited });
    if (decision && decision.action === 'wait' && sleep) {
      await sleep(decision.seconds);
      waited = true;
      index -= 1;                     // the same row, once more
      continue;
    }
    if (decision) {
      // The allowance or a limit is spent. The honest outcome is INCOMPLETE.
      stoppedBy = `AI_RATE_LIMITED at ${row.id}: evaluation allowance or rate limit reached (Retry-After ${decision.seconds} s)`;
      break;
    }
    waited = false;
    const s = scoreCase(row, actual);
    scored.push(s);
    if (onRow) onRow(s);
  }
  return { scored, latencies, usage, stoppedBy };
}

const percentile = (values, p) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
};

function versionInfo(app) {
  const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
  return {
    ...app.service.VERSIONS,
    prompt_sha256: sha(app.prompt.INSTRUCTIONS),
    schema_sha256: sha(JSON.stringify(app.contract.PROVIDER_SCHEMA)),
  };
}

/**
 * N3: the code a run used, named by content. `start` is the manifest taken
 * before the first row; a second one is taken now, and any difference is
 * reported instead of attributing every result to one snapshot.
 */
function codeEvidence(start, root = ROOT) {
  const end = buildManifest({ root });
  const diff = compareManifests(start, end);
  return {
    manifest: start,
    end_aggregate_sha256: end.aggregate_sha256,
    changed_during_run: !diff.same,
    changed_files: [...diff.changed, ...diff.added, ...diff.removed].sort(),
    git: gitSupplement(root),
  };
}

/** N4: what was selected out of the split, and whether it is the whole split. */
function selectionOf({ split, available, planned, scored, limit, rerunReason = null }) {
  const supported = (rows) => rows.filter((r) => r.kind === 'nl').length;
  return {
    split,
    limit,
    available_rows: available.length,
    selected_rows: planned.length,
    scored_rows: scored,
    supported: { selected: supported(planned), available: supported(available) },
    exploratory: { selected: planned.length - supported(planned), available: available.length - supported(available) },
    holdout_rows_selected: planned.filter((r) => r.split === 'holdout').length,
    partial: planned.length < available.length || scored < planned.length,
    holdout_rerun_reason: rerunReason,
  };
}

const posixRelative = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function writeReport(report) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  const stamp = report.started_at.replace(/[:.]/g, '-');
  const base = `${report.mode.toLowerCase()}-${stamp}`;
  fs.writeFileSync(path.join(REPORT_DIR, `${base}.json`), `${JSON.stringify(report, null, 2)}\n`);
  const md = markdownReport(report);
  fs.writeFileSync(path.join(REPORT_DIR, `${base}.md`), md);
  fs.writeFileSync(path.join(REPORT_DIR, `${report.mode.toLowerCase()}-latest.md`), md);
  return path.relative(ROOT, path.join(REPORT_DIR, `${base}.md`));
}

// ---------------------------------------------------------------------- CLI

function parseArgs(argv) {
  const args = { live: false, dryRun: false, limit: null, split: null, rerunHoldout: null, corpus: DEFAULT_CORPUS, manifest: DEFAULT_MANIFEST };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--live') args.live = true;
    else if (a === '--dry-run') args.dryRun = true;
    else if (a === '--limit') args.limit = argv[++i];
    else if (a === '--split') args.split = argv[++i];
    else if (a === '--corpus') args.corpus = path.resolve(argv[++i]);
    else if (a === '--manifest') args.manifest = path.resolve(argv[++i]);
    else if (a === '--rerun-holdout') {
      args.rerunHoldout = String(argv[++i] || '').trim();
      if (args.rerunHoldout.length < 10) throw new Error('--rerun-holdout needs a reason of at least 10 characters');
    }
    else throw new Error(`unknown argument ${a}`);
  }
  return args;
}

function selectRows(rows, split) {
  if (split === null || split === 'all') return rows;
  if (!['dev', 'holdout'].includes(split)) throw new Error('--split must be dev, holdout or all');
  return rows.filter((r) => r.split === split || (split === 'dev' && r.kind !== 'nl'));
}

async function runFixture(args) {
  const corpus = loadCorpus({ corpusPath: args.corpus, manifestPath: args.manifest });
  const split = args.split || 'all';
  const rows = selectRows(corpus.rows, args.split);
  const startManifest = buildManifest({ root: ROOT });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallet-ai-eval-'));
  const app = loadApp(path.join(dir, 'eval.db'));
  const started = new Date().toISOString();
  try {
    const generous = { globalDaily: 1e6, userDaily: 1e6, userMinute: 1e6, maxConcurrent: 1, perUserConcurrent: 1 };
    const run = await runRows(app, rows, {
      provider: (row) => ({ mode: 'demo', extract: async () => ({ kind: 'output', output: row.fixture_output }) }),
      limitsFor: (clock) => app.limitsModule.createLimits({ db: app.db, limits: generous, clock }),
    });
    const summary = summarize(run.scored);
    const threshold = checkThresholds(summary, { expectedRows: rows.filter((r) => r.kind === 'nl').length, requireAllPass: true });
    const result = threshold.ok ? 'PASS' : 'FAIL';
    const code = codeEvidence(startManifest);
    const selection = selectionOf({ split, available: rows, planned: rows, scored: run.scored.length, limit: null });
    const report = {
      mode: 'FIXTURE',
      model_quality: 'NOT_MEASURED',
      result,
      verdict: qualityVerdict({ mode: 'FIXTURE', result, split, partial: selection.partial, changedDuringRun: code.changed_during_run }),
      started_at: started,
      finished_at: new Date().toISOString(),
      corpus: { path: posixRelative(args.corpus), sha256: corpus.sha256, version: corpus.manifest.version },
      selection,
      versions: versionInfo(app),
      code,
      provider: { id: 'none', name: 'fixture', model: 'none', calls_attempted: 0, real_provider_requests: 0, local_fake_requests: 0 },
      allowance: null,
      summary,
      threshold,
      mismatches: run.scored.filter((s) => !s.pass),
      latency_ms: null,
      usage: null,
      stopped_by: run.stoppedBy,
    };
    return { report, exitCode: threshold.ok && !code.changed_during_run ? 0 : 1 };
  } finally {
    app.db.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function evalDbPath() {
  return process.env.WALLET_AI_EVAL_DB ? path.resolve(process.env.WALLET_AI_EVAL_DB) : DEFAULT_EVAL_DB;
}

/** L1: the evaluation's own finite daily allowance, or why there is none. */
function evalAllowance(env) {
  const raw = env.WALLET_AI_EVAL_DAILY_CALLS;
  if (raw === undefined || raw === '') return { missing: 'WALLET_AI_EVAL_DAILY_CALLS=<1-200>' };
  const n = Number(raw);
  if (!/^\d+$/.test(String(raw)) || n < 1 || n > MAX_EVAL_DAILY_CALLS) {
    return { missing: `WALLET_AI_EVAL_DAILY_CALLS=<1-${MAX_EVAL_DAILY_CALLS}> (got an unusable value)` };
  }
  return { calls: n };
}

/** Today's evaluation reservations, read without creating anything. */
function usedToday(dbPath) {
  if (!fs.existsSync(dbPath)) return 0;
  const Database = require('better-sqlite3');
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const row = db.prepare("SELECT count FROM ai_quota WHERE period = ? AND scope = 'global-day' AND user_id = 0").get(day);
    return row ? row.count : 0;
  } catch (_) {
    return 0;
  } finally {
    db.close();
  }
}

/**
 * Test seam: forward the adapter's requests to a local fake. Honoured only
 * while the network guard is active in this process, so it cannot turn a
 * real run into a fake one by accident, nor the reverse.
 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * D-041: the only fake URL the test seam accepts — a plain loopback HTTP
 * origin with an explicit port and nothing else. Returns the normalised origin
 * that the forwarding fetch is built from; anything else throws.
 */
function loopbackFakeBase(raw) {
  const refuse = () => {
    throw new Error('test seam refused: WALLET_AI_EVAL_TEST_FAKE_URL must be http://127.0.0.1:<port>, http://localhost:<port> or http://[::1]:<port>, with no credentials, path, query or fragment');
  };
  // Checked on the raw text too: the URL parser drops an empty "?" or "#".
  if (typeof raw !== 'string' || /[?#@\s\\]/.test(raw)) refuse();
  let url;
  try {
    url = new URL(raw);
  } catch {
    refuse();
  }
  if (url.protocol !== 'http:' || !LOOPBACK_HOSTS.has(url.hostname)) refuse();
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') refuse();
  const port = Number(url.port);
  if (!/^\d{1,5}$/.test(url.port) || port < 1 || port > 65535) refuse();
  return `http://${url.hostname}:${port}`;
}

function testSeam(providerId, model) {
  const fakeUrl = process.env.WALLET_AI_EVAL_TEST_FAKE_URL;
  if (fakeUrl === undefined || fakeUrl === '') return null;
  // D-041: the seam hands the provider key to another address, so it needs
  // proof that the guard is in force in this process — not a variable saying so —
  // and a strictly loopback address. Both are checked before any database,
  // report or request exists.
  if (!isGuardActive()) {
    throw new Error('test seam refused: the network guard is not active in this process; WALLET_AI_EVAL_TEST_FAKE_URL needs qa/ai/support/no-network.js preloaded, and an environment variable is not proof');
  }
  const base = loopbackFakeBase(fakeUrl);
  if (!providerId) return null;
  const { forwardingFetch } = require('./support/fake-openai');
  const noWait = process.env.WALLET_AI_EVAL_TEST_NO_WAIT === '1';
  // The selected adapter's own URL, forwarded to the same path on the fake. For
  // Gemini it contains the model id (D-044); an unusable id is a missing
  // prerequisite in runLive, so no fetch can be built for it here.
  if (providerId === 'gemini') {
    const gemini = require(path.join(ROOT, 'src', 'ai', 'gemini.js'));
    if (!gemini.normalizeGeminiModel(model)) return { fetchImpl: () => Promise.reject(new Error('no Gemini model id')), noWait };
    return { fetchImpl: forwardingFetch(base, gemini.geminiGenerateUrl(model)), noWait };
  }
  return { fetchImpl: forwardingFetch(base, require(path.join(ROOT, 'src', 'ai', 'openai.js')).API_URL), noWait };
}

const PROVIDER_NAMES = { openai: 'OpenAI', gemini: 'Gemini' };

async function runLive(args) {
  // N2: one split per live run. "all" would send holdout rows inside an
  // ordinary run; the holdout rule below also follows the planned rows.
  if (args.split === 'all') {
    throw new Error('live evaluation runs one split at a time: --split dev (the default) or --split holdout; "all" would send holdout rows as part of an ordinary run');
  }
  const corpus = loadCorpus({ corpusPath: args.corpus, manifestPath: args.manifest });
  const split = args.split || 'dev';
  const selected = selectRows(corpus.rows, split);
  const { loadConfig } = require(path.join(ROOT, 'src', 'ai', 'config.js'));
  const config = loadConfig({ ...process.env, WALLET_AI_MODE: 'live' });
  // D-040: exactly the provider WALLET_AI_PROVIDER names. An unknown value is
  // in config.missing and runs nothing; neither provider stands in for the other.
  const providerId = config.provider;
  const model = providerId === 'gemini' ? config.geminiModel : config.model;
  const evalAllowed = process.env.WALLET_AI_EVAL_LIVE === 'true';
  const limit = args.limit === null ? null : Number(args.limit);
  if (args.limit !== null && (!Number.isInteger(limit) || limit < 1)) throw new Error('--limit must be a positive integer');
  const planned = limit === null ? selected : selected.slice(0, limit);
  const plannedHoldout = planned.filter((r) => r.split === 'holdout');

  // N1 (was L6): never an application database — compared by real path and
  // file identity, before anything is read, not by path spelling.
  const dbPath = evalDbPath();
  const protectedPaths = protectedDatabasePaths({ root: ROOT });
  assertDistinctDatabase(dbPath, protectedPaths);

  const allowance = evalAllowance(process.env);
  const missing = [...config.missing];
  if (!evalAllowed) missing.push('WALLET_AI_EVAL_LIVE=true');
  if (allowance.missing) missing.push(allowance.missing);
  if (limit === null) missing.push('--limit N');
  // D-044: the Gemini model id becomes a URL path segment, so it must be a
  // plain id (letters, digits, dots, hyphens) before anything else happens.
  if (providerId === 'gemini' && model && !require(path.join(ROOT, 'src', 'ai', 'gemini.js')).normalizeGeminiModel(model)) {
    missing.push('WALLET_AI_GEMINI_MODEL=<a model id such as gemini-2.5-flash-lite>');
  }

  const seam = testSeam(providerId, model);
  const { INSTRUCTIONS } = require(path.join(ROOT, 'src', 'ai', 'prompt.js'));
  const approxChars = planned.reduce((sum, r) => sum + INSTRUCTIONS.length + r.text.length + 400, 0);
  const used = usedToday(dbPath);
  const left = allowance.calls ? Math.max(0, allowance.calls - used) : 0;
  // D-043: read-only; the binding check is the atomic reservation at dispatch.
  const windowNow = readWindowState(dbPath);
  const startManifest = buildManifest({ root: ROOT });
  console.log(`corpus OK: ${corpus.rows.length} rows, sha256 ${corpus.sha256.slice(0, 12)}…`);
  console.log(`split ${split}: ${selected.length} rows; planned provider calls: ${planned.length} (at most one per row, no retries)`);
  console.log(`provider: ${providerId || '(unknown: nothing will run)'}; model: ${model || '(not set)'}; max output tokens per call: ${config.maxOutputTokens}; timeout: ${config.timeoutMs} ms`);
  if (providerId === 'gemini') {
    console.log('GEMINI FREE: synthetic corpus only, never real expenses; Free Tier input may be used by Google to improve its products; this project\'s actual RPM/RPD are shown in Google AI Studio and are not configured here');
  }
  console.log(`approximate prompt size: ${approxChars} characters in total (a character count, not a token or price estimate)`);
  console.log(`note: reasoning models count reasoning tokens inside the ${config.maxOutputTokens}-token output limit; an answer cut off as incomplete is still billed and scores as an error. Start with --limit 1 and read its usage line`);
  console.log('price: unknown — no pricing is configured here; the report will show actual token counts where the provider returns them, and "unknown" where it does not');
  console.log(`evaluation allowance: ${allowance.calls ? `${allowance.calls} calls/day, ${left} left today` : 'not set'}; database ${path.relative(ROOT, dbPath) || dbPath}`);
  console.log(`evaluation window: ${windowNow.used} of ${EVAL_WINDOW.calls} provider calls used in the last ${EVAL_WINDOW.ms / 60000} minutes; next call available ${availabilityText(windowNow.availableAtMs)}`);
  console.log(`app pilot limits (not used by evaluation, not to be raised for it): ${JSON.stringify(config.limits)}`);
  console.log(`source manifest: sha256 ${startManifest.aggregate_sha256.slice(0, 16)}… over ${startManifest.file_count} files; missing required: ${startManifest.missing_required.length === 0 ? 'none' : startManifest.missing_required.join(', ')}`);
  if (plannedHoldout.length > 0) console.log(`HOLDOUT: ${plannedHoldout.length} holdout row(s) planned; reserved once per corpus, provider, model and versions; a rerun needs --rerun-holdout "<reason>"`);
  if (seam) console.log('TEST SEAM: provider requests are forwarded to a local fake; nothing here measures a model');

  if (args.dryRun) {
    console.log(`network guard: ${isGuardActive() ? 'active' : 'NOT active'}`);
    console.log('dry run: nothing is sent and nothing is written; an existing evaluation database is only opened read-only for today\'s count');
    console.log(missing.length === 0
      ? 'DRY RUN: every live prerequisite is present. Zero remote calls were made.'
      : `DRY RUN: live prerequisites missing: ${missing.join(', ')}. Zero remote calls were made.`);
    return { report: null, exitCode: 0 };
  }
  if (missing.length > 0) {
    console.log(`LIVE NOT RUN: missing ${missing.join(', ')}`);
    return { report: null, exitCode: 3 };
  }
  // N2: a holdout run spent on a run the allowance cuts short cannot be taken back.
  if (plannedHoldout.length > 0 && planned.length > left) {
    console.log(`LIVE NOT RUN: this holdout run needs ${planned.length} provider calls but the evaluation allowance has ${left} left today; a holdout run must fit in one day so it is not cut short`);
    return { report: null, exitCode: 3 };
  }
  // D-043: the whole run must fit the rolling window now, so it is refused
  // before any database is opened for writing and before any request.
  if (planned.length > EVAL_WINDOW.calls) {
    console.log(`LIVE NOT RUN: evaluation rate limit: at most ${WINDOW_TEXT}, and this run plans ${planned.length}; use --limit ${EVAL_WINDOW.calls} or less`);
    return { report: null, exitCode: 3 };
  }
  const windowFit = readWindowState(dbPath, Date.now(), planned.length);
  if (windowFit.free < planned.length) {
    console.log(`LIVE NOT RUN: evaluation rate limit: ${WINDOW_TEXT}; ${windowFit.used} used, ${windowFit.free} free, this run plans ${planned.length}; `
      + `next ${planned.length === 1 ? 'call' : `${planned.length} calls`} available ${availabilityText(windowFit.availableAtMs)}`);
    return { report: null, exitCode: 3 };
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  assertDistinctDatabase(dbPath, protectedPaths);          // again, immediately before the open
  const app = loadApp(dbPath);
  let ledgerId = null;
  let calls = 0;
  let outcome = null;
  try {
    // D-043: additive; existing evaluation databases keep all their rows.
    ensureWindowTable(app.db);
    const versions = versionInfo(app);
    if (plannedHoldout.length > 0) {
      const claim = reserveHoldout(app.db, {
        identity: holdoutIdentity({ corpus, versions, model, provider: providerId }),
        plannedIds: plannedHoldout.map((r) => r.id),
        reason: args.rerunHoldout,
        codeManifestSha256: startManifest.aggregate_sha256,
        startedAt: new Date().toISOString(),
      });
      if (!claim.reserved) {
        const earlier = claim.previous.map((p) => `${p.started_at}: ${p.result === null ? 'unfinished' : p.result}`).join('; ');
        console.log(`HOLDOUT ALREADY RUN for this corpus, provider, model and versions (${earlier}). Record why before rerunning: --rerun-holdout "<reason>"`);
        return { report: null, exitCode: 3 };
      }
      ledgerId = claim.id;
    }

    const adapterOptions = { model, timeoutMs: config.timeoutMs, maxOutputTokens: config.maxOutputTokens, ...(seam ? { fetchImpl: seam.fetchImpl } : {}) };
    // The Gemini adapter is loaded here and nowhere in the application (D-040).
    const provider = providerId === 'gemini'
      ? require(path.join(ROOT, 'src', 'ai', 'gemini.js')).createGeminiProvider({ apiKey: config.geminiApiKey, ...adapterOptions })
      : app.openai.createOpenAIProvider({ apiKey: config.apiKey, ...adapterOptions });
    const realClock = { now: () => new Date() };
    // The evaluator's own limits only (D-043, corrected after an independent review):
    // the daily allowance from WALLET_AI_EVAL_DAILY_CALLS, the rolling window
    // enforced at dispatch, and the fixed values below. None comes from the
    // application's pilot limits (config.limits), which are not read here.
    const evalLimits = { globalDaily: allowance.calls, userDaily: allowance.calls, ...EVAL_FIXED_LIMITS };
    const limits = app.limitsModule.createLimits({ db: app.db, limits: evalLimits, clock: realClock });
    const sleep = seam && seam.noWait ? async () => {} : (seconds) => new Promise((r) => setTimeout(r, seconds * 1000));
    const started = new Date().toISOString();
    // D-042: per row, the numeric HTTP status of a non-2xx provider answer.
    // Only the number is read from the error; the error itself is rethrown to
    // the service unchanged.
    const httpStatusByRow = new Map();
    const run = await runRows(app, planned, {
      provider: (row) => ({
        mode: 'live',
        extract: async (input) => {
          // D-043: one slot of the rolling window, reserved atomically in the
          // evaluation database immediately before dispatch. A refusal throws
          // before any request; a failed request keeps its slot.
          reserveCall(app.db, { provider: providerId, model, kind: seam ? 'local_fake' : 'real', rowId: row.id });
          calls += 1;
          httpStatusByRow.delete(row.id);
          try {
            return await provider.extract(input);
          } catch (err) {
            const status = httpStatusOf(err);
            if (status !== null) httpStatusByRow.set(row.id, status);
            throw err;
          }
        },
      }),
      limitsFor: () => limits,
      onRow: (s) => console.log(`${s.id} ${s.pass ? 'match' : 'MISMATCH'}`),
      sleep,
      httpStatusFor: (row) => (httpStatusByRow.has(row.id) ? httpStatusByRow.get(row.id) : null),
    });
    const summary = summarize(run.scored);
    const threshold = checkThresholds(summary, { expectedRows: planned.filter((r) => r.kind === 'nl').length });
    const result = run.stoppedBy ? 'INCOMPLETE' : threshold.ok ? 'PASS' : 'FAIL';
    outcome = result;
    const code = codeEvidence(startManifest);
    const selection = selectionOf({ split, available: selected, planned, scored: run.scored.length, limit, rerunReason: args.rerunHoldout || null });
    const mode = seam ? 'LIVE-TEST-SEAM' : 'LIVE';
    let modelQuality = 'MEASURED_ON_SYNTHETIC_CORPUS';
    if (seam) modelQuality = 'NOT_MEASURED (local fake)';
    else if (selection.partial) modelQuality = `PILOT_SAMPLE (${selection.scored_rows} of ${selection.available_rows} rows)`;
    const report = {
      mode,
      model_quality: modelQuality,
      result,
      verdict: qualityVerdict({ mode, result, split, partial: selection.partial, changedDuringRun: code.changed_during_run }),
      started_at: started,
      finished_at: new Date().toISOString(),
      corpus: { path: posixRelative(args.corpus), sha256: corpus.sha256, version: corpus.manifest.version },
      selection,
      versions,
      code,
      provider: {
        id: providerId,
        name: seam ? `${PROVIDER_NAMES[providerId]} adapter → local fake` : PROVIDER_NAMES[providerId],
        model,
        calls_attempted: calls,
        real_provider_requests: seam ? 0 : calls,
        local_fake_requests: seam ? calls : 0,
        // D-042: numeric statuses of non-2xx answers only; an empty object
        // means no answer was non-2xx (a failure without any HTTP answer has none).
        http_error_statuses: httpErrorStatuses(run.scored),
      },
      allowance: {
        daily_calls: allowance.calls,
        used_before_run: used,
        window: { calls: EVAL_WINDOW.calls, minutes: EVAL_WINDOW.ms / 60000, used_before_run: windowFit.used },
      },
      summary,
      threshold,
      mismatches: run.scored.filter((s) => !s.pass),
      latency_ms: { p50: percentile(run.latencies, 50), p95: percentile(run.latencies, 95), n: run.latencies.length },
      // L4: counts where the provider reported them; missing usage is unknown, never 0.
      usage: {
        calls,
        known_calls: run.usage.calls_with_usage,
        unknown_calls: calls - run.usage.calls_with_usage,
        input_tokens_known: run.usage.input_tokens,
        output_tokens_known: run.usage.output_tokens,
        reasoning_tokens_known: run.usage.calls_with_reasoning > 0 ? run.usage.reasoning_tokens : null,
        reasoning_known_calls: run.usage.calls_with_reasoning,
        unusable_calls_with_usage: run.usage.unusable_with_usage,
      },
      holdout_ledger_id: ledgerId,
      stopped_by: run.stoppedBy,
    };
    return { report, exitCode: result === 'PASS' && !code.changed_during_run ? 0 : 1 };
  } catch (err) {
    outcome = 'ERROR';
    throw err;
  } finally {
    // A reservation is completed, never removed; a killed process leaves it unfinished.
    if (ledgerId !== null) finishHoldout(app.db, ledgerId, { result: outcome, callsAttempted: calls, finishedAt: new Date().toISOString() });
    app.db.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.live && (args.dryRun || args.limit !== null)) throw new Error('--dry-run and --limit belong to --live');
  if (!args.live || args.dryRun) {
    // Fixture mode and dry runs never need the network; prove it in-process (L5).
    require('./support/no-network');
  }
  const { report, exitCode } = args.live ? await runLive(args) : await runFixture(args);
  if (report) {
    const where = writeReport(report);
    const s = report.summary.supported;
    const sel = report.selection;
    console.log(`MODE=${report.mode} MODEL_QUALITY=${report.model_quality} RESULT=${report.result}`);
    console.log(`SCOPE=${sel.partial ? 'PARTIAL' : 'FULL'} (selected ${sel.selected_rows} of ${sel.available_rows} rows in split ${sel.split}, scored ${sel.scored_rows}) VERDICT=${report.verdict.code}: ${report.verdict.text}`);
    console.log(`supported rows ${s.rows}; row match ${pct(s.row_pass)}; complete ${pct(s.complete_draft_rate)}; amount ${pct(s.amount_accuracy)}; date ${pct(s.date_accuracy)}; category ${pct(s.category_accuracy)}; false ready ${s.false_ready}; invented amount/date ${s.invented_numeric_fields}; wrong amount/date ${s.wrong_numeric_fields}`);
    if (!report.threshold.ok) for (const f of report.threshold.failures) console.log(`  FAIL ${f}`);
    if (report.mode !== 'FIXTURE') {
      const u = report.usage;
      console.log(`provider calls attempted: ${report.provider.calls_attempted}${report.mode === 'LIVE-TEST-SEAM' ? ' (TEST: forwarded to a local fake, not a real provider)' : ''}`);
      console.log(`real provider requests: ${report.provider.real_provider_requests}; local fake requests: ${report.provider.local_fake_requests}`);
      console.log(`provider HTTP errors: ${httpErrorLine(report.provider.http_error_statuses)}`);
      console.log(`usage: known for ${u.known_calls} call(s) (input ${u.input_tokens_known}, output ${u.output_tokens_known} tokens); unknown for ${u.unknown_calls} call(s)`);
    }
    if (report.code.changed_during_run) console.log(`SOURCE CHANGED DURING RUN: ${report.code.changed_files.join(', ')} — results belong to no single code snapshot`);
    if (report.stopped_by) console.log(`STOPPED: ${report.stopped_by}`);
    console.log(`source manifest: ${report.code.manifest.aggregate_sha256} (${report.code.manifest.file_count} files)`);
    console.log(`report: ${where}`);
  }
  return exitCode;
}

if (require.main === module) {
  main().then((code) => { process.exitCode = code; }).catch((err) => {
    console.error(err instanceof CorpusError ? err.message : `evaluator error: ${err.message}`);
    process.exitCode = 2;
  });
}

module.exports = { loadCorpus, scoreCase, summarize, checkThresholds, rateLimitDecision, loopbackFakeBase, CorpusError, THRESHOLDS, MIN_NL_ROWS };
