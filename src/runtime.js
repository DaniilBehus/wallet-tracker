'use strict';

// The installed SQLite binding requires Node-API 10. Reject unsupported
// runtimes before loading it or creating a data directory.
function isSupportedRuntime(versions = process.versions) {
  const { node, napi } = versions || {};
  if (typeof node !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(node)) return false;
  if (typeof napi !== 'string' || !/^(0|[1-9]\d*)$/.test(napi)) return false;
  const [major, minor, patch] = node.split('.').map(Number);
  const api = Number(napi);
  if (![major, minor, patch, api].every(Number.isSafeInteger) || api < 10) return false;
  return (major === 22 && minor >= 14) || (major === 23 && minor >= 6) || major >= 24;
}

function assertSupportedRuntime(versions) {
  if (isSupportedRuntime(versions)) return;
  const error = new Error('Wallet requires stable Node.js ^22.14.0 || >=23.6.0 with Node-API >=10. Upgrade to a current patched supported LTS release.');
  error.code = 'ERR_UNSUPPORTED_WALLET_RUNTIME';
  throw error;
}

module.exports = { isSupportedRuntime, assertSupportedRuntime };
