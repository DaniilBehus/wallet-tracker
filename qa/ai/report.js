'use strict';

/*
 * Human-readable evaluation reports (N4, independent review 2026-09-16).
 *
 * Rendered only from the structured report the evaluator writes as JSON, so
 * the two cannot disagree. Rules the tests hold this file to:
 *
 *   * every mode says how many requests reached a real provider and how many a
 *     local fake — a fake request is never called a real one;
 *   * token usage is "known for K of N calls"; a call without reported usage
 *     is unknown, never 0, and unusable answers that still reported usage
 *     (billed, e.g. incomplete) are counted;
 *   * no cost is computed — there is no verified pricing here;
 *   * PASS, FAIL and INCOMPLETE get the same heading;
 *   * the scope says how many of the split's rows were selected, and a partial
 *     live run is a pilot, never quality acceptance; full dev and full holdout
 *     verdicts have different codes;
 *   * a source change during the run is stated before any number.
 */

function pct(r) {
  if (!r || typeof r.den !== 'number') return 'n/a';
  return r.den === 0 ? 'n/a (0/0)' : `${(r.value * 100).toFixed(1)}% (${r.num}/${r.den})`;
}

/**
 * What a run's numbers may be used for.
 * @returns {{code: string, text: string}}
 */
function qualityVerdict({ mode, result, split, partial, changedDuringRun }) {
  if (mode === 'FIXTURE') return { code: 'NOT_APPLICABLE', text: 'fixture outputs stand in for the model; no model quality is measured' };
  if (mode === 'LIVE-TEST-SEAM') return { code: 'NOT_APPLICABLE', text: 'requests went to a local fake; no model quality is measured' };
  if (changedDuringRun) return { code: 'NOT_ASSESSED', text: 'the source changed during the run, so the results belong to no single code snapshot' };
  if (result === 'INCOMPLETE') return { code: 'NOT_ASSESSED', text: 'the run stopped before every selected row was scored' };
  if (partial) {
    return { code: 'PILOT_ONLY', text: `pilot ${result === 'PASS' ? 'passed' : 'failed'} on the selected rows only; this is not quality acceptance for the ${split} split` };
  }
  const side = split === 'holdout' ? 'HOLDOUT' : 'DEV';
  return result === 'PASS'
    ? { code: `${side}_THRESHOLDS_MET`, text: `every row of the ${split} split was scored and the acceptance thresholds were met` }
    : { code: `${side}_THRESHOLDS_NOT_MET`, text: `every row of the ${split} split was scored and the acceptance thresholds were not met` };
}

function scopeLine(sel) {
  return `${sel.partial ? 'PARTIAL' : 'FULL'} — selected ${sel.selected_rows} of ${sel.available_rows} rows in split ${sel.split} `
    + `(supported ${sel.supported.selected} of ${sel.supported.available}, exploratory ${sel.exploratory.selected} of ${sel.exploratory.available}); `
    + `scored ${sel.scored_rows}${sel.limit === null ? '' : `; --limit ${sel.limit}`}`;
}

function requestsLine(provider) {
  const fixture = provider.name === 'fixture' ? ' (fixture outputs, no provider)' : '';
  return `real provider requests: ${provider.real_provider_requests}; local fake requests: ${provider.local_fake_requests}${fixture}`;
}

/**
 * D-042: "400 ×1, 503 ×2" from { "400": 1, "503": 2 }; "none" when empty. Only
 * numeric statuses are ever in the object — never an upstream body or header.
 */
function httpErrorLine(statuses) {
  const entries = Object.entries(statuses || {})
    .filter(([status, count]) => /^\d{3}$/.test(status) && Number.isInteger(count))
    .sort(([a], [b]) => Number(a) - Number(b));
  return entries.length === 0 ? 'none' : entries.map(([status, count]) => `${status} ×${count}`).join(', ');
}

function usageLines(usage) {
  if (usage === null) return ['- Token usage: not applicable (no provider was called)'];
  const reasoning = usage.reasoning_known_calls > 0 ? `, of which reasoning ${usage.reasoning_tokens_known} where reported` : '';
  const known = usage.known_calls === 0
    ? `known for 0 of ${usage.calls} attempted calls (no token totals known)`
    : `known for ${usage.known_calls} of ${usage.calls} attempted calls (input ${usage.input_tokens_known}, output ${usage.output_tokens_known} tokens${reasoning})`;
  return [
    `- Token usage: ${known}; unknown for ${usage.unknown_calls} call(s)`,
    `- Unusable answers that still reported usage: ${usage.unusable_calls_with_usage}`,
  ];
}

const short = (hex) => (typeof hex === 'string' && /^[0-9a-f]{64}$/.test(hex) ? `${hex.slice(0, 16)}…` : String(hex));

function codeLines(code) {
  const m = code.manifest;
  const lines = [
    `- Source manifest: sha256 ${short(m.aggregate_sha256)} over ${m.file_count} files (full list in the JSON report); `
      + `missing required: ${m.missing_required.length === 0 ? 'none' : m.missing_required.join(', ')}; `
      + `links not followed: ${m.skipped_links.length === 0 ? 'none' : m.skipped_links.join(', ')}`,
    `- Git (supplemental): HEAD ${code.git.head === 'unavailable' ? 'unavailable' : code.git.head.slice(0, 12)}, diff sha256 ${short(code.git.dirty_diff_sha256)}`,
  ];
  return lines;
}

function markdownReport(report) {
  const s = report.summary.supported;
  const sel = report.selection;
  const lines = [
    `# AI extraction evaluation — ${report.mode}`,
    '',
    `## RESULT: ${report.result}`,
    '',
    `MODE=${report.mode}  MODEL_QUALITY=${report.model_quality}  RESULT=${report.result}  SCOPE=${sel.partial ? 'PARTIAL' : 'FULL'}  VERDICT=${report.verdict.code}`,
    '',
    `Verdict: ${report.verdict.text}.`,
    '',
  ];
  if (report.code.changed_during_run) {
    lines.push(`**SOURCE CHANGED DURING RUN** — manifest ${short(report.code.manifest.aggregate_sha256)} at start, ${short(report.code.end_aggregate_sha256)} at the end; changed: ${report.code.changed_files.join(', ')}.`, '');
  }
  if (report.stopped_by) lines.push(`**STOPPED:** ${report.stopped_by}`, '');
  lines.push(
    `- Started: ${report.started_at}  Finished: ${report.finished_at}`,
    `- Scope: ${scopeLine(sel)}`,
    `- Corpus: ${report.corpus.path} sha256 ${report.corpus.sha256} (v${report.corpus.version})`,
    `- Versions: schema ${report.versions.schema}, prompt ${report.versions.prompt} (${short(report.versions.prompt_sha256)}), normalizer ${report.versions.normalizer}`,
    ...codeLines(report.code),
    `- Provider: ${report.provider.name} (${report.provider.id}); model ${report.provider.model}; attempted calls ${report.provider.calls_attempted}`,
    `- Requests: ${requestsLine(report.provider)}`,
    ...(report.provider.http_error_statuses && typeof report.provider.http_error_statuses === 'object'
      ? [`- Provider HTTP errors: ${httpErrorLine(report.provider.http_error_statuses)}`]
      : []),
    ...usageLines(report.usage),
    '- Cost: not computed (no verified pricing; the token counts above are the evidence)',
  );
  if (report.allowance) lines.push(`- Evaluation allowance: ${report.allowance.daily_calls} calls/day; ${report.allowance.used_before_run} used before this run`);
  const w = report.allowance && report.allowance.window;
  if (w) lines.push(`- Evaluation rate window: ${w.calls} provider calls per rolling ${w.minutes} minutes; ${w.used_before_run} used when this run started`);
  if (sel.holdout_rerun_reason) lines.push(`- Holdout rerun reason: ${sel.holdout_rerun_reason}`);
  lines.push(
    '',
    '## Supported-language rows',
    '',
    '| Metric | Value | Target |',
    '|---|---|---|',
    `| Complete correct draft | ${pct(s.complete_draft_rate)} | ≥ 90% |`,
    `| Amount | ${pct(s.amount_accuracy)} | ≥ 98% |`,
    `| Date | ${pct(s.date_accuracy)} | ≥ 98% |`,
    `| Category | ${pct(s.category_accuracy)} | ≥ 90% |`,
    `| Coverage (ready on ready rows) | ${pct(s.coverage)} | — |`,
    `| Status | ${pct(s.status_accuracy)} | — |`,
    `| Expected issue codes present | ${pct(s.issue_recall)} | — |`,
    `| Row matches label | ${pct(s.row_pass)} | ${report.mode === 'FIXTURE' ? '100%' : '—'} |`,
    `| False ready | ${s.false_ready} | 0 |`,
    `| Invented amount/date | ${s.invented_numeric_fields} | 0 |`,
    `| Wrong non-null amount/date | ${s.wrong_numeric_fields} | 0 |`,
    `| Invented category | ${s.invented_category} | — |`,
    `| Errors (contract/transport/refusal as error) | ${s.errors} | — |`,
    '',
    '## By language',
    '',
    '| Language | Rows | Row match | Complete draft |',
    '|---|---|---|---|',
    ...Object.entries(report.summary.by_language).map(([k, m]) => `| ${k} | ${m.rows} | ${pct(m.row_pass)} | ${pct(m.complete_draft_rate)} |`),
    '',
    '## By split',
    '',
    '| Split | Rows | Row match | Complete draft |',
    '|---|---|---|---|',
    ...Object.entries(report.summary.by_split).map(([k, m]) => `| ${k} | ${m.rows} | ${pct(m.row_pass)} | ${pct(m.complete_draft_rate)} |`),
    '',
    `Exploratory rows (not in any denominator above): ${report.summary.exploratory.rows}, matching label ${pct(report.summary.exploratory.row_pass)}`,
    '',
    '## Threshold check',
    '',
    report.threshold.ok ? 'All gates met for the scored rows.' : report.threshold.failures.map((f) => `- ${f}`).join('\n'),
    '',
    '## Rows not matching their label',
    '',
    ...(report.mismatches.length === 0 ? ['None.'] : report.mismatches.map((m) => `- ${m.id} (${m.language}, ${m.split}): failed ${Object.entries(m.checks).filter(([, ok]) => !ok).map(([k]) => k).join(', ') || 'error'}; expected ${JSON.stringify(m.expected)}; actual ${JSON.stringify(m.actual)}`)),
    '',
  );
  if (report.mode === 'FIXTURE') {
    lines.push('Fixture outputs stand in for the model. These numbers check the normaliser, the contracts and this evaluator. They are not a measurement of any model.', '');
  }
  if (report.latency_ms) {
    lines.push(report.latency_ms.n === 0
      ? 'Latency (service, ms): no calls were timed.'
      : `Latency (service, ms): p50 ${report.latency_ms.p50}, p95 ${report.latency_ms.p95}, n=${report.latency_ms.n}.`, '');
  }
  return lines.join('\n');
}

module.exports = { markdownReport, qualityVerdict, pct, httpErrorLine };
