'use strict';

// Provider adapters. Each AI capability sits behind a small interface so the
// owner's provider choice (and keys) live in env, never in the app.
//
// Two modes:
//   - MOCK  (no keys set): returns safe fake data so the whole app can be
//           exercised locally without spending money or leaking keys.
//   - LIVE  (keys set):    the real implementation is wired in a later step.
//
// This file never logs key values.

const { pickTier } = require('../router');

function hasKey(name) {
  const value = process.env[name];
  return typeof value === 'string' && value.trim().length > 0;
}

// LLM goes live when a provider is selected. The key may be injected by the
// proxy (this session) or set in the environment (a real server), so the mode
// follows LLM_PROVIDER, not only the presence of a key. Default: gemini (free,
// no credit card).
const llmProvider = (process.env.LLM_PROVIDER || '').toLowerCase();
const llmLive =
  llmProvider === 'gemini' || llmProvider === 'openai' || hasKey('LLM_API_KEY');

const mode = {
  llm: llmLive ? 'live' : 'mock',
  stt: hasKey('STT_API_KEY') ? 'live' : 'mock',
  tts: hasKey('TTS_API_KEY') ? 'live' : 'mock',
  pronunciation: hasKey('PRONUNCIATION_API_KEY') ? 'live' : 'mock',
};

// ---- LLM --------------------------------------------------------------------

async function runTutorTurn({ task, systemPrompt, learnerText }) {
  const tier = pickTier(task);
  if (mode.llm === 'mock') {
    return {
      tier,
      reply: `(${tier}) I heard: "${learnerText}". Let's keep going!`,
      correction: 'ok',
      tip: 'Mock mode: set LLM_PROVIDER=openai and add a key to use the real tutor.',
    };
  }
  if (llmProvider === 'gemini' || llmProvider === '') {
    // Default live provider is Gemini (free tier, no credit card).
    return require('./gemini').runTutorTurn({ task, systemPrompt, learnerText });
  }
  if (llmProvider === 'openai') {
    return require('./openai').runTutorTurn({ task, systemPrompt, learnerText });
  }
  throw new Error(`Unknown LLM provider: ${llmProvider}`);
}

// ---- Speech to text ---------------------------------------------------------

async function transcribe(/* audioChunkStream */) {
  if (mode.stt === 'mock') {
    return { text: '(mock transcript)', isFinal: true };
  }
  throw new Error('STT live adapter not implemented yet');
}

// ---- Text to speech ---------------------------------------------------------

async function synthesize({ text }) {
  if (mode.tts === 'mock') {
    // A tiny silent placeholder; the app treats an empty buffer as "no audio".
    return { audio: Buffer.alloc(0), contentType: 'audio/mpeg', text };
  }
  throw new Error('TTS live adapter not implemented yet');
}

// ---- Pronunciation ----------------------------------------------------------

async function scorePronunciation({ expectedText }) {
  if (mode.pronunciation === 'mock') {
    const words = String(expectedText || '').split(/\s+/).filter(Boolean);
    return {
      overall: 0,
      mock: true,
      words: words.map((w) => ({ word: w, score: 0 })),
    };
  }
  throw new Error('Pronunciation live adapter not implemented yet');
}

module.exports = {
  mode,
  runTutorTurn,
  transcribe,
  synthesize,
  scorePronunciation,
};
