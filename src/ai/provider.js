'use strict';

// Which provider, if any, answers draft requests in this process.
//
// Production: off -> none; live -> the OpenAI adapter, only when config says
// every live prerequisite is present. Demo is never built here: its fixture
// answers live under qa/ and exist only when `npm run ai:demo` installs them.
//
// `installProvider` is a process-level seam for qa runners that start the real
// server with a deterministic transport. It is not reachable through HTTP and
// no request field can select or change a provider.

const { createOpenAIProvider } = require('./openai');

let installed = null;
let liveProvider = null;

function installProvider(provider) {
  if (!provider || typeof provider.extract !== 'function' || !['demo', 'live'].includes(provider.mode)) {
    throw new Error('installProvider needs { mode: demo|live, extract() }');
  }
  installed = provider;
}

const MESSAGES = {
  default: 'AI suggestions are not available; enter the expense manually',
  gemini: 'The Gemini test provider is for synthetic evaluation only and does not accept real financial records; enter the expense manually',
};

function resolveProvider(config) {
  if (config.mode === 'off') return null;
  // D-040: only OpenAI can serve the application. Gemini Free is synthetic
  // evaluation only and an unknown provider enables nothing. This runs before
  // the test seam, so not even an installed test provider becomes a fallback.
  // This module never requires the Gemini adapter.
  if (config.provider !== 'openai') return null;
  if (installed && installed.mode === config.mode) return installed;
  if (config.mode === 'demo') return null;
  if (!config.liveReady) return null;
  if (!liveProvider) {
    liveProvider = createOpenAIProvider({
      apiKey: config.apiKey,
      model: config.model,
      timeoutMs: config.timeoutMs,
      maxOutputTokens: config.maxOutputTokens,
    });
  }
  return liveProvider;
}

/** The fixed AI_UNAVAILABLE message for this configuration. */
function unavailableMessage(config) {
  return config.provider === 'gemini' ? MESSAGES.gemini : MESSAGES.default;
}

module.exports = { installProvider, resolveProvider, unavailableMessage };
