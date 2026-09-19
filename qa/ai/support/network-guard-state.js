'use strict';

// Process-local proof that qa/ai/support/no-network.js is in force in THIS
// process (D-041, from an independent review).
//
// The evaluator's test seam sends a provider request — with the key header —
// to a local fake. It used to trust WALLET_NO_NETWORK_GUARD=active, an
// environment variable anyone can type next to WALLET_AI_EVAL_TEST_FAKE_URL.
// An environment variable is a claim; this module checks a fact:
//
//   * the guard records the wrapper functions it installed, in this process's
//     memory, under a registry symbol no environment variable, argument or
//     child process can set; and
//   * isGuardActive() is true only while net.Socket.prototype.connect,
//     net.connect, net.createConnection and tls.connect are still exactly those
//     wrappers. Replacing any of them withdraws the proof.
//
// Symbol.for rather than a module variable: a disposable source copy loads its
// own instance of this module while the guard may have been preloaded from the
// checkout; both must see the same process-wide record. Code already running
// inside the process could still forge it — that is not the threat here and is
// not claimed.

const net = require('net');
const tls = require('tls');

const RECORD = Symbol.for('wallet.qa.ai.networkGuard.installedWrappers');

/** Called by no-network.js after it has patched the connect functions. */
function recordGuard(wrappers) {
  Object.defineProperty(globalThis, RECORD, { value: Object.freeze({ ...wrappers }), configurable: true, enumerable: false, writable: false });
}

function isGuardActive() {
  const w = globalThis[RECORD];
  return Boolean(w)
    && typeof w.socketConnect === 'function'
    && net.Socket.prototype.connect === w.socketConnect
    && net.connect === w.connect
    && net.createConnection === w.createConnection
    && tls.connect === w.tlsConnect;
}

module.exports = { recordGuard, isGuardActive };
