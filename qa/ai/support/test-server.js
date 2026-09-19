'use strict';

// Child-process entry for AI integration and browser tests: the real Wallet
// server, with the real OpenAI adapter whose fetch is pointed at a local fake.
//
// Only qa/ runners start this file. src/ never reads WALLET_AI_TEST_FAKE_URL,
// and nothing reachable over HTTP can install or change a provider.

require('./no-network');

const path = require('path');
const SRC = path.join(__dirname, '..', '..', '..', 'src');
const { installProvider } = require(path.join(SRC, 'ai', 'provider'));
const { createOpenAIProvider, API_URL } = require(path.join(SRC, 'ai', 'openai'));
const { forwardingFetch } = require('./fake-openai');

const fakeUrl = process.env.WALLET_AI_TEST_FAKE_URL;
if (process.env.WALLET_AI_MODE === 'live' && fakeUrl) {
  installProvider(createOpenAIProvider({
    // Deliberately recognisable, so a leak check can search logs and reports
    // for it. It is not a credential for anything.
    apiKey: 'sk-test-not-a-real-key-7f3c',
    model: 'fake-model-for-tests',
    timeoutMs: Number(process.env.WALLET_AI_TIMEOUT_MS || 15000),
    maxOutputTokens: 600,
    fetchImpl: forwardingFetch(fakeUrl, API_URL),
  }));
}

require(path.join(SRC, 'server.js'));
