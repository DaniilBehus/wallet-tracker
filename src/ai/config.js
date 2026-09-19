'use strict';

// AI feature configuration (spec/ai-expense-entry.md §3 and §7, D-034).
//
// Read once from an env object passed in, so tests can build a config without
// touching process.env. Invalid numbers fall back to their defaults with a
// warning; an invalid mode falls back to off. Nothing here ever prints a
// secret — only whether one is present.

const MODES = ['off', 'demo', 'live'];

// D-040. An empty value is the default (openai). An unknown value enables
// nothing — it is never read as the nearest provider. `gemini` is Gemini Free
// for synthetic evaluation (qa/ai/evaluate.js --live) and is never live in the
// application; see src/ai/provider.js.
const PROVIDERS = ['openai', 'gemini'];

const BOUNDS = {
  WALLET_AI_TIMEOUT_MS: { def: 15000, min: 1000, max: 30000 },
  WALLET_AI_MAX_OUTPUT_TOKENS: { def: 600, min: 100, max: 2000 },
  WALLET_AI_GLOBAL_DAILY_CALLS: { def: 20, min: 1, max: 10000 },
  WALLET_AI_USER_DAILY_CALLS: { def: 5, min: 1, max: 1000 },
  WALLET_AI_USER_MINUTE_CALLS: { def: 3, min: 1, max: 100 },
  WALLET_AI_MAX_CONCURRENT: { def: 2, min: 1, max: 20 },
};

function boundedInt(env, name, warnings) {
  const { def, min, max } = BOUNDS[name];
  const raw = env[name];
  if (raw === undefined || raw === '') return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) {
    warnings.push(`${name} must be an integer between ${min} and ${max}; using ${def}`);
    return def;
  }
  return n;
}

/**
 * @returns {{mode, requestedMode, provider, blockedReason, liveReady, missing,
 *            model, apiKey, geminiModel, geminiApiKey, timeoutMs,
 *            maxOutputTokens, limits, warnings}}
 */
function loadConfig(env = process.env) {
  const warnings = [];
  const requested = (env.WALLET_AI_MODE || 'off').trim().toLowerCase();
  let mode = MODES.includes(requested) ? requested : 'off';
  if (!MODES.includes(requested)) warnings.push('WALLET_AI_MODE is not off|demo|live; using off');

  const requestedProvider = (env.WALLET_AI_PROVIDER || '').trim().toLowerCase();
  const provider = requestedProvider === '' ? 'openai' : PROVIDERS.includes(requestedProvider) ? requestedProvider : null;
  if (provider === null) warnings.push('WALLET_AI_PROVIDER is not openai|gemini; AI stays unavailable');

  const apiKey = env.OPENAI_API_KEY || '';
  const model = (env.WALLET_AI_MODEL || '').trim();
  const liveAllowed = env.WALLET_AI_LIVE_ALLOWED === 'true';
  const geminiApiKey = env.GEMINI_API_KEY || '';
  const geminiModel = (env.WALLET_AI_GEMINI_MODEL || '').trim();

  // Names of missing prerequisites, never their values. Each provider has its
  // own: one provider's key never stands in for the other's.
  const missing = [];
  if (mode === 'live') {
    if (provider === null) {
      missing.push('WALLET_AI_PROVIDER=openai|gemini');
    } else if (provider === 'openai') {
      if (!apiKey) missing.push('OPENAI_API_KEY');
      if (!model) missing.push('WALLET_AI_MODEL');
      if (!liveAllowed) missing.push('WALLET_AI_LIVE_ALLOWED=true');
    } else {
      if (!geminiApiKey) missing.push('GEMINI_API_KEY');
      if (!geminiModel) missing.push('WALLET_AI_GEMINI_MODEL');
    }
  }

  return {
    mode,
    requestedMode: requested,
    provider,
    // Gemini Free may use prompts to improve Google products: real financial
    // descriptions must never reach it, so the application cannot enable it.
    blockedReason: provider === 'gemini' ? 'GEMINI_SYNTHETIC_EVALUATION_ONLY' : null,
    liveReady: mode === 'live' && provider === 'openai' && missing.length === 0,
    missing,
    apiKey,
    model,
    geminiApiKey,
    geminiModel,
    timeoutMs: boundedInt(env, 'WALLET_AI_TIMEOUT_MS', warnings),
    maxOutputTokens: boundedInt(env, 'WALLET_AI_MAX_OUTPUT_TOKENS', warnings),
    limits: {
      globalDaily: boundedInt(env, 'WALLET_AI_GLOBAL_DAILY_CALLS', warnings),
      userDaily: boundedInt(env, 'WALLET_AI_USER_DAILY_CALLS', warnings),
      userMinute: boundedInt(env, 'WALLET_AI_USER_MINUTE_CALLS', warnings),
      maxConcurrent: boundedInt(env, 'WALLET_AI_MAX_CONCURRENT', warnings),
      perUserConcurrent: 1,
    },
    warnings,
  };
}

module.exports = { loadConfig, MODES, PROVIDERS, BOUNDS };
