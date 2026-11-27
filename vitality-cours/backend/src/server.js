'use strict';

// Minimal dependency-free HTTP server for VITALITY COURS.
// Endpoints:
//   GET  /health            -> status + which providers are live vs mock
//   POST /session           -> validate a (language, level, style) and return the tutor prompt id
//   POST /tutor-turn        -> run one tutor turn (routed LLM); mock-safe without keys
//   POST /pronunciation     -> pronunciation scores for expected text
//
// Streaming STT/TTS over WebSocket is added in a later step. This file keeps
// the contract small and testable. No secret is ever written to a response or log.

const http = require('http');
const { buildTutorPrompt } = require('./personaPrompt');
const { TASK } = require('./router');
const providers = require('./providers');

const PORT = Number(process.env.PORT) || 8080;
const MAX_BODY_BYTES = 256 * 1024;

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (chunks.length === 0) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

async function handleSession(req, res) {
  const body = await readJsonBody(req);
  const { targetLanguage, level, style } = body;
  const prompt = buildTutorPrompt({ targetLanguage, level, style });
  sendJson(res, 200, { ok: true, systemPrompt: prompt });
}

async function handleTutorTurn(req, res) {
  const body = await readJsonBody(req);
  const { targetLanguage, level, style, learnerText, task } = body;
  const systemPrompt = buildTutorPrompt({ targetLanguage, level, style });
  const result = await providers.runTutorTurn({
    task: task || TASK.CONVERSATION,
    systemPrompt,
    learnerText: String(learnerText || ''),
  });
  sendJson(res, 200, { ok: true, ...result });
}

async function handlePronunciation(req, res) {
  const body = await readJsonBody(req);
  const result = await providers.scorePronunciation({
    expectedText: String(body.expectedText || ''),
  });
  sendJson(res, 200, { ok: true, ...result });
}

const routes = {
  'POST /session': handleSession,
  'POST /tutor-turn': handleTutorTurn,
  'POST /pronunciation': handlePronunciation,
};

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://localhost:${PORT}`);
      const key = `${req.method} ${url.pathname}`;

      if (key === 'GET /health') {
        return sendJson(res, 200, { ok: true, providers: providers.mode });
      }

      const handler = routes[key];
      if (!handler) return sendJson(res, 404, { ok: false, error: 'Not found' });

      await handler(req, res);
    } catch (err) {
      // Client errors (validation) vs server errors; never leak internals/keys.
      const message = err && err.message ? err.message : 'Unexpected error';
      const clientError = /Unsupported|requires|Invalid JSON|too large|Unknown task/i.test(message);
      sendJson(res, clientError ? 400 : 500, { ok: false, error: message });
    }
  });
}

if (require.main === module) {
  createServer().listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`[vitality-cours] backend on :${PORT} (providers: ${JSON.stringify(providers.mode)})`);
  });
}

module.exports = { createServer };
