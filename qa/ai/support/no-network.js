'use strict';

// Preloaded into every AI test process and every server it starts
// (NODE_OPTIONS=--require …). Any TCP/TLS connection to a host that is not the
// loopback interface fails with NETWORK_BLOCKED_IN_TESTS before any packet.
//
// AI-R13 says default tests make no real network calls. "There is no API key"
// is not a boundary — a key can be inherited from a shell, a CI secret or a
// .env file. This is the boundary: even with a valid key in the environment,
// a connection to api.openai.com cannot be opened from these processes. qa/ai
// proves the guard itself fails closed (tests/network-guard.test.js).

const net = require('net');
const tls = require('tls');

const LOOPBACK = new Set(['127.0.0.1', 'localhost', '::1', '::ffff:127.0.0.1']);

function hostOf(args) {
  const [first, second] = args;
  if (first && typeof first === 'object' && !Array.isArray(first)) {
    if (first.path) return null;            // IPC / named pipe
    return first.host || first.hostname || 'localhost';
  }
  if (typeof first === 'string' && Number.isNaN(Number(first))) return null; // path
  return typeof second === 'string' ? second : 'localhost';
}

function blockedError(args) {
  const host = hostOf(args);
  if (host === null || LOOPBACK.has(host)) return null;
  const err = new Error(`NETWORK_BLOCKED_IN_TESTS: connection to ${host} refused by qa/ai/support/no-network.js`);
  err.code = 'NETWORK_BLOCKED_IN_TESTS';
  return err;
}

// A refused connection behaves like a network failure: the socket is returned
// and then destroyed with the error on the next tick. Throwing synchronously
// instead escapes fetch's internals as an uncaught exception, which crashes
// the process rather than failing the one request.
function refuse(socket, err) {
  process.nextTick(() => socket.destroy(err));
  return socket;
}

const originalSocketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const err = blockedError(normalized);
  if (err) return refuse(this, err);
  return originalSocketConnect.apply(this, args);
};

for (const [mod, name] of [[net, 'connect'], [net, 'createConnection'], [tls, 'connect']]) {
  const original = mod[name];
  mod[name] = function guarded(...args) {
    const err = blockedError(args);
    if (err) return refuse(new net.Socket(), err);
    return original.apply(this, args);
  };
}

// D-041: record the installed wrappers as process-local proof. There is no
// environment marker any more: a variable can be typed without this file ever
// running, and children would inherit it.
require('./network-guard-state').recordGuard({
  socketConnect: net.Socket.prototype.connect,
  connect: net.connect,
  createConnection: net.createConnection,
  tlsConnect: tls.connect,
});
