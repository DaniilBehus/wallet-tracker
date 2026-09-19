'use strict';

// Auth-scoped context -> provider -> validated draft
// (spec/ai-expense-entry.md §4.3 precedence; D-034).
//
// WRITE BOUNDARY: this module reads the caller's categories and, through
// limits.js, increments quota counters. It has no statement that touches
// transactions, schedules, settings or users, and qa/ai proves at the HTTP
// level that no parse branch changes a financial table.

const crypto = require('crypto');
const { ApiError } = require('../errors');
const { dayAfter } = require('../dates');
const contract = require('./contract');
const { buildPrompt, PROMPT_VERSION } = require('./prompt');
const { derive, unsupportedResult, ContractViolation, NORMALIZER_VERSION, dayBefore, codePointLength } = require('./normalize');
const { ProviderError } = require('./openai');
const { localParts } = require('./limits');

const MAX_CATEGORIES = 100;
const MAX_CATEGORY_BYTES = 8000;

const VERSIONS = { schema: contract.SCHEMA_VERSION, prompt: PROMPT_VERSION, normalizer: NORMALIZER_VERSION };

const PROVIDER_STATUS = {
  AI_TIMEOUT: [504, 'The AI service took too long; enter the expense manually'],
  AI_PROVIDER_BUSY: [503, 'The AI service is busy; try again later or enter the expense manually'],
  AI_PROVIDER_FAILED: [502, 'The AI service could not be reached'],
  AI_INVALID_RESPONSE: [502, 'The AI service returned an answer that could not be used'],
};

function toApiError(err) {
  if (err instanceof ProviderError) {
    const [status, message] = PROVIDER_STATUS[err.code] || PROVIDER_STATUS.AI_PROVIDER_FAILED;
    return new ApiError(status, err.code in PROVIDER_STATUS ? err.code : 'AI_PROVIDER_FAILED', message);
  }
  if (err instanceof contract.InvalidProviderOutput || err instanceof ContractViolation) {
    return contract.invalidResponse();
  }
  return null;
}

/**
 * @param {object} deps
 * @param {import('better-sqlite3').Database} deps.db
 * @param {() => object|null} deps.getProvider
 * @param {ReturnType<import('./limits').createLimits>} deps.limits
 * @param {{now: () => Date}} deps.clock
 * @param {(entry: object) => void} deps.log   safe fields only
 * @param {() => string} [deps.unavailableMessage]  fixed text for AI_UNAVAILABLE (D-040)
 */
function createDraftService({ db, getProvider, limits, clock, log, unavailableMessage = () => 'AI suggestions are not available; enter the expense manually' }) {
  const readCategories = db.prepare('SELECT id, name FROM categories WHERE user_id = ? ORDER BY id');

  function capabilities() {
    const provider = getProvider();
    return {
      enabled: Boolean(provider),
      mode: provider ? provider.mode : 'off',
      provider: provider ? (provider.mode === 'live' ? 'OpenAI' : 'demo') : null,
      max_input_chars: contract.MAX_INPUT_CODE_POINTS,
      languages: ['en', 'uk', 'sk'],
      requires_external_consent: Boolean(provider && provider.mode === 'live'),
    };
  }

  async function createDraft({ userId, body, rawBytes, signal }) {
    const started = Date.now();
    const requestId = crypto.randomUUID();
    let outcome = 'error';
    let usage = null;

    try {
      // 3. shape, length, bytes, reference date
      const request = contract.validateDraftRequest(body, rawBytes);
      const serverToday = localParts(clock.now()).day;
      const allowed = [dayBefore(serverToday), serverToday, dayAfter(serverToday)];
      if (!allowed.includes(request.referenceDate)) {
        throw new ApiError(400, 'REFERENCE_DATE_MISMATCH', 'The device date differs from the server date; check it or type an explicit date');
      }

      // 4. mode
      const provider = getProvider();
      if (!provider) throw new ApiError(503, 'AI_UNAVAILABLE', unavailableMessage());

      // 5. consent — live only; demo contacts no external service
      if (provider.mode === 'live' && request.consent !== true) {
        throw new ApiError(403, 'AI_CONSENT_REQUIRED', 'Confirm that the description may be sent to the AI service');
      }

      // 6. category context, owned by this user only
      const categories = readCategories.all(userId);
      const nameBytes = categories.reduce((sum, c) => sum + Buffer.byteLength(c.name, 'utf8'), 0);
      if (categories.length > MAX_CATEGORIES || nameBytes > MAX_CATEGORY_BYTES) {
        throw new ApiError(422, 'AI_CONTEXT_TOO_LARGE', 'Too many categories for AI suggestions; enter the expense manually');
      }
      const refs = new Map();
      const context = categories.map((c, index) => {
        const ref = `c${index}`;
        refs.set(ref, c.id);
        return { ref, name: c.name };
      });

      // 7. concurrency slot, then atomic quota reservation
      const release = limits.acquireSlot(userId);
      try {
        limits.reserve(userId);

        // 8. provider — at most one request
        const prompt = buildPrompt({
          text: request.text,
          referenceDate: request.referenceDate,
          locale: request.locale,
          categories: context,
        });
        const answer = await provider.extract({
          ...prompt,
          schema: contract.PROVIDER_SCHEMA,
          signal,
          // Demo fixtures match on the description; the live adapter ignores it.
          text: request.text,
        });
        usage = answer.usage || null;

        let result;
        if (answer.kind === 'refusal') result = unsupportedResult('MODEL_REFUSED');
        else if (answer.kind === 'demo_unsupported') result = unsupportedResult('DEMO_UNSUPPORTED');
        else {
          // 9. provider output shape, 10. deterministic normalisation
          contract.validateProviderOutput(answer.output);
          result = derive({
            text: request.text,
            referenceDate: request.referenceDate,
            serverToday,
            output: answer.output,
            refs,
          });
        }

        outcome = result.status;
        return {
          request_id: requestId,
          mode: provider.mode,
          status: result.status,
          draft: result.draft,
          provenance: result.provenance,
          issues: result.issues,
          versions: VERSIONS,
        };
      } finally {
        release();
      }
    } catch (err) {
      // A billed but unusable answer still reports what it cost (L7).
      if (usage === null && err && err.usage) usage = err.usage;
      const mapped = toApiError(err);
      const final = mapped || err;
      outcome = final instanceof ApiError ? final.code : 'UNHANDLED';
      throw final;
    } finally {
      // Correlation id, outcome, duration, versions, token counts. Never the
      // description, category names, provider body, auth header or key.
      log({
        event: 'ai_draft',
        request_id: requestId,
        outcome,
        ms: Date.now() - started,
        versions: VERSIONS,
        usage,
      });
    }
  }

  return { capabilities, createDraft };
}

module.exports = { createDraftService, VERSIONS, MAX_CATEGORIES, MAX_CATEGORY_BYTES, codePointLength };
