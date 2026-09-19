'use strict';

/*
 * "The holdout split runs once" as a record (N2, independent review 2026-09-16; D-039).
 *
 * The rule follows the rows a live run is about to send, not the spelling of
 * --split: the evaluator reserves whenever its planned rows contain a holdout
 * row. The reservation is one IMMEDIATE transaction — check and insert under
 * SQLite's write lock — so two evaluator processes cannot both claim a first
 * run. It happens before any provider dispatch and is never deleted: a run that
 * errors, stops or is killed keeps its record (result stays NULL when the
 * process died before finishing), and a new run for the same identity needs a
 * written reason.
 *
 * Identity of a holdout run: frozen corpus (sha256, version, holdout id list),
 * provider, model, and the declared versions (schema, prompt, normaliser,
 * prompt and provider-schema hashes). D-040: for OpenAI the key is computed
 * exactly as in S24, so records made before Gemini existed keep counting; any
 * other provider adds its id to the key, so a Gemini run and an OpenAI run of
 * the same model name are never the same record. The content manifest is recorded but is not part of
 * the identity: an unrelated comment must not grant a new first run.
 *
 * Migration policy: the S23 table `eval_holdout_runs(versions_key, model,
 * started_at, reason)` is left untouched and still consulted. Its rows carry no
 * corpus identity, so a row counts as a prior run of any corpus with the same
 * versions and model — fail closed.
 */

const crypto = require('crypto');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS eval_holdout_ledger (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  run_key              TEXT NOT NULL,
  corpus_sha256        TEXT NOT NULL,
  corpus_version       TEXT NOT NULL,
  holdout_ids_sha256   TEXT NOT NULL,
  model                TEXT NOT NULL,
  provider             TEXT,
  versions_json        TEXT NOT NULL,
  code_manifest_sha256 TEXT NOT NULL,
  planned_ids_json     TEXT NOT NULL,
  reason               TEXT,
  started_at           TEXT NOT NULL,
  finished_at          TEXT,
  result               TEXT,
  calls_attempted      INTEGER
)`;

function holdoutIdentity({ corpus, versions, model, provider = 'openai' }) {
  const holdoutIdsSha = sha256(JSON.stringify([...corpus.manifest.holdout_ids].sort()));
  const parts = {
    corpus_sha256: corpus.sha256,
    corpus_version: String(corpus.manifest.version),
    holdout_ids_sha256: holdoutIdsSha,
    model,
    versions,
  };
  if (provider !== 'openai') parts.provider = provider;
  return { ...parts, provider, run_key: sha256(JSON.stringify(parts)) };
}

/**
 * @returns {{reserved: true, id: number, previous: object[]} | {reserved: false, previous: object[]}}
 */
function reserveHoldout(db, { identity, plannedIds, reason, codeManifestSha256, startedAt }) {
  const claim = db.transaction(() => {
    db.exec(LEDGER_SQL);
    // S24 ledgers were created without the provider column; their rows are OpenAI runs.
    if (!db.prepare('PRAGMA table_info(eval_holdout_ledger)').all().some((c) => c.name === 'provider')) {
      db.exec('ALTER TABLE eval_holdout_ledger ADD COLUMN provider TEXT');
    }
    const previous = db.prepare('SELECT started_at, result, reason FROM eval_holdout_ledger WHERE run_key = ? ORDER BY id').all(identity.run_key);
    // The S23 table predates every provider but OpenAI.
    const legacyTable = identity.provider === 'openai'
      && db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'eval_holdout_runs'").get();
    if (legacyTable) {
      const legacy = db.prepare('SELECT started_at, reason FROM eval_holdout_runs WHERE versions_key = ? AND model = ? ORDER BY rowid')
        .all(JSON.stringify(identity.versions), identity.model);
      for (const row of legacy) previous.push({ started_at: row.started_at, result: 'legacy record, corpus not recorded', reason: row.reason });
    }
    if (previous.length > 0 && !reason) return { reserved: false, previous };
    const info = db.prepare(`INSERT INTO eval_holdout_ledger
      (run_key, corpus_sha256, corpus_version, holdout_ids_sha256, model, provider, versions_json, code_manifest_sha256, planned_ids_json, reason, started_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
      identity.run_key, identity.corpus_sha256, identity.corpus_version, identity.holdout_ids_sha256, identity.model, identity.provider,
      JSON.stringify(identity.versions), codeManifestSha256, JSON.stringify(plannedIds), reason || null, startedAt,
    );
    return { reserved: true, id: Number(info.lastInsertRowid), previous };
  });
  return claim.immediate();
}

/** Completes a reservation. Only an unfinished record is updated; nothing is ever deleted. */
function finishHoldout(db, id, { result, callsAttempted, finishedAt }) {
  db.prepare('UPDATE eval_holdout_ledger SET finished_at = ?, result = ?, calls_attempted = ? WHERE id = ? AND finished_at IS NULL')
    .run(finishedAt, result, callsAttempted, id);
}

module.exports = { LEDGER_SQL, holdoutIdentity, reserveHoldout, finishHoldout };
