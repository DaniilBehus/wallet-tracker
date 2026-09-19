'use strict';

// The environment `npm run test:ai` gives its child: everything that could
// switch a real provider on, or carry a key, is removed first. A key in the
// owner's shell, a CI secret or .env therefore changes nothing in tests.
// GEMINI_* and GOOGLE_* were added with the Gemini adapter (D-040): the
// adapter reads GEMINI_API_KEY, and Google's own tools also read GOOGLE_API_KEY.

const REMOVED = /^(OPENAI_|GEMINI_|GOOGLE_|WALLET_AI_)/i;

function scrubbedEnv(env) {
  const out = {};
  for (const [key, value] of Object.entries(env)) {
    if (REMOVED.test(key) || key === 'NODE_OPTIONS') continue;
    out[key] = value;
  }
  return out;
}

module.exports = { scrubbedEnv, REMOVED };
