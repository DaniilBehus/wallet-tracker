'use strict';

// A local stand-in for the OpenAI Responses endpoint, used by integration and
// browser tests. It speaks the same raw REST shape the real adapter parses, so
// the REAL adapter (src/ai/openai.js) is exercised: request body, Authorization
// header, redirect refusal, timeout, byte cap and response parsing.
//
// It never contacts anything. The test decides every answer:
//
//   plan(step)   queue one response  { output } | { refusal } | { status, body }
//                | { raw } | { redirect } | { hugeBytes } | { incomplete }
//                with optional { delayMs, gate: Promise }
//   requests     every request received: { authorization, body, url }
//
// An unplanned request answers 500 and is recorded in `unplanned`, so a test
// can assert that nothing was called when nothing should have been.
//
// The control surface is JS for in-process tests and HTTP (/__control/*) for
// the browser suite, whose test process cannot share memory with the server.

const http = require('http');

function responseEnvelope(output) {
  return {
    id: 'resp_fake',
    object: 'response',
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: JSON.stringify(output) }],
      },
    ],
    usage: { input_tokens: 120, output_tokens: 40 },
  };
}

function createFakeOpenAI() {
  const queue = [];
  const requests = [];
  const unplanned = [];
  const gates = new Map();
  let server = null;

  function plan(step) {
    queue.push(step);
  }

  async function readBody(req) {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    return Buffer.concat(chunks).toString('utf8');
  }

  async function respond(res, step) {
    if (step.delayMs) await new Promise((r) => setTimeout(r, step.delayMs));
    if (step.gate) {
      await new Promise((resolve) => {
        if (gates.get(step.gate) === 'open') return resolve();
        gates.set(step.gate, resolve);
      });
    }
    if (res.destroyed) return;

    if (step.redirect) {
      res.writeHead(302, { Location: 'http://127.0.0.1:1/steal' });
      return res.end();
    }
    if (step.status) {
      res.writeHead(step.status, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(step.body || { error: { message: 'fake upstream error' } }));
    }
    if (step.hugeBytes) {
      // No Content-Length: the cap must hold while streaming.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      const chunk = 'x'.repeat(8192);
      let sent = 0;
      while (sent < step.hugeBytes && !res.destroyed) {
        res.write(chunk);
        sent += chunk.length;
      }
      return res.end();
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    if (step.raw !== undefined) return res.end(typeof step.raw === 'string' ? step.raw : JSON.stringify(step.raw));
    if (step.refusal) {
      return res.end(JSON.stringify({
        status: 'completed',
        output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'I cannot help with that.' }] }],
      }));
    }
    if (step.incomplete) {
      return res.end(JSON.stringify({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [], ...(step.usage ? { usage: step.usage } : {}) }));
    }
    return res.end(JSON.stringify(responseEnvelope(step.output)));
  }

  async function handler(req, res) {
    const url = new URL(req.url, 'http://127.0.0.1');

    if (url.pathname === '/__control/plan' && req.method === 'POST') {
      plan(JSON.parse(await readBody(req)));
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname === '/__control/open-gate' && req.method === 'POST') {
      const { gate } = JSON.parse(await readBody(req));
      openGate(gate);
      res.writeHead(204);
      return res.end();
    }
    if (url.pathname === '/__control/state' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ requests: requests.length, unplanned: unplanned.length, queued: queue.length }));
    }
    if (url.pathname === '/__control/reset' && req.method === 'POST') {
      reset();
      res.writeHead(204);
      return res.end();
    }

    if (url.pathname === '/v1/responses' && req.method === 'POST') {
      const body = await readBody(req);
      const record = { authorization: req.headers.authorization || null, body: JSON.parse(body), url: req.url };
      requests.push(record);
      const step = queue.shift();
      if (!step) {
        unplanned.push(record);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end('{"error":{"message":"unplanned request"}}');
      }
      return respond(res, step);
    }

    res.writeHead(404);
    res.end();
  }

  function listen(port = 0) {
    return new Promise((resolve) => {
      server = http.createServer((req, res) => {
        handler(req, res).catch(() => {
          if (!res.headersSent) res.writeHead(500);
          res.end();
        });
      });
      server.listen(port, '127.0.0.1', () => resolve(`http://127.0.0.1:${server.address().port}`));
    });
  }

  function openGate(name) {
    const waiting = gates.get(name);
    gates.set(name, 'open');
    if (typeof waiting === 'function') waiting();
  }

  function close() {
    // Held gates would keep sockets open forever; tests end, sockets end.
    for (const waiting of gates.values()) if (typeof waiting === 'function') waiting();
    if (!server) return Promise.resolve();
    return new Promise((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    });
  }

  function reset() {
    for (const waiting of gates.values()) if (typeof waiting === 'function') waiting();
    queue.length = 0;
    requests.length = 0;
    unplanned.length = 0;
    gates.clear();
  }

  return { plan, listen, close, reset, openGate, requests, unplanned, queue };
}

/** A fetch that sends the adapter's request to the fake instead of api.openai.com. */
function forwardingFetch(fakeBaseUrl, expectedUrl) {
  // The same path on the fake: /v1/responses for OpenAI, /v1beta/models/{model}:generateContent
  // for Gemini. Anything but the adapter's fixed URL is refused.
  const { pathname } = new URL(expectedUrl);
  return (url, init) => {
    if (url !== expectedUrl) {
      return Promise.reject(new Error(`adapter requested an unexpected URL: ${url}`));
    }
    return fetch(`${fakeBaseUrl}${pathname}`, init);
  };
}

module.exports = { createFakeOpenAI, forwardingFetch, responseEnvelope };
