'use strict';

// Dependency-free test runner for the VITALITY COURS backend.
// Run with: node test/run.js   (or: npm test)

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');

const { buildTutorPrompt } = require('../src/personaPrompt');
const { pickTier, TASK } = require('../src/router');
const providers = require('../src/providers');
const { createServer } = require('../src/server');

const personas = JSON.parse(
  fs.readFileSync(
    path.join(__dirname, '..', '..', 'app', 'assets', 'personas', 'personas.json'),
    'utf8'
  )
);
const level = personas.levels.find((l) => l.id === 'beginner');
const style = personas.styles.find((s) => s.id === 'business');

let passed = 0;
let failed = 0;
async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗ ${name}\n    ${err.message}`);
    failed++;
  }
}

function request(server, method, pathName, bodyObj) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const data = bodyObj ? JSON.stringify(bodyObj) : null;
    const req = http.request(
      { host: '127.0.0.1', port: addr.port, method, path: pathName,
        headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      (res) => {
        let buf = '';
        res.on('data', (c) => (buf += c));
        res.on('end', () => resolve({ status: res.statusCode, json: buf ? JSON.parse(buf) : null }));
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  console.log('\n=== VITALITY COURS backend ===\n');

  await test('buildTutorPrompt includes language, level and style', () => {
    const p = buildTutorPrompt({ targetLanguage: 'es', level, style });
    assert.ok(p.includes('Spanish'));
    assert.ok(p.includes(String(level.sentenceMaxWords)));
    assert.ok(/Business|business/.test(p));
  });

  await test('buildTutorPrompt rejects an unsupported language', () => {
    assert.throws(() => buildTutorPrompt({ targetLanguage: 'zz', level, style }), /Unsupported/);
  });

  await test('router sends quick correction to the small tier', () => {
    assert.strictEqual(pickTier(TASK.QUICK_CORRECTION), 'small');
    assert.strictEqual(pickTier(TASK.DETAILED_FEEDBACK), 'large');
  });

  await test('providers default to mock when no keys are set', () => {
    assert.strictEqual(providers.mode.llm, 'mock');
  });

  const server = createServer().listen(0);
  await new Promise((r) => server.once('listening', r));
  try {
    await test('GET /health reports provider modes', async () => {
      const res = await request(server, 'GET', '/health');
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.providers);
    });

    await test('POST /tutor-turn returns a mock reply without keys', async () => {
      const res = await request(server, 'POST', '/tutor-turn', {
        targetLanguage: 'en', level, style, learnerText: 'I goed to work', task: TASK.CONVERSATION,
      });
      assert.strictEqual(res.status, 200);
      assert.ok(res.json.reply.includes('I goed to work'));
      assert.ok('correction' in res.json);
    });

    await test('POST /pronunciation returns a score per word', async () => {
      const res = await request(server, 'POST', '/pronunciation', { expectedText: 'good morning' });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.json.words.length, 2);
    });

    await test('bad JSON body is a 400, not a crash', async () => {
      const addr = server.address();
      const res = await new Promise((resolve, reject) => {
        const req = http.request({ host: '127.0.0.1', port: addr.port, method: 'POST', path: '/session',
          headers: { 'Content-Type': 'application/json' } }, (r) => {
          let b = ''; r.on('data', (c) => (b += c)); r.on('end', () => resolve({ status: r.statusCode }));
        });
        req.on('error', reject); req.write('{not json'); req.end();
      });
      assert.strictEqual(res.status, 400);
    });
  } finally {
    server.close();
  }

  console.log(`\n${failed ? 'FAILED' : 'Passed'}: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
