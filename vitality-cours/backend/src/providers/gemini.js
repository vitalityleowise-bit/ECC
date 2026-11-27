'use strict';

// Live Google Gemini adapter for the tutor LLM. Gemini's free tier needs no
// credit card, so it is the default for VITALITY COURS. The key is read from the
// environment on a real server; in this session the proxy injects it, so the
// header value here is a placeholder, never a real secret.

const { pickTier } = require('../router');

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Logical tier -> Gemini model. Flash is fast and free-tier friendly.
const MODEL_BY_TIER = {
  small: process.env.GEMINI_MODEL_SMALL || 'gemini-2.0-flash',
  standard: process.env.GEMINI_MODEL_STANDARD || 'gemini-2.0-flash',
  large: process.env.GEMINI_MODEL_LARGE || 'gemini-2.0-flash',
};

function apiKey() {
  const key = process.env.GEMINI_API_KEY;
  // On a real server GEMINI_API_KEY is set. In this session the proxy replaces
  // the header, so a placeholder is enough and no real key is ever in code.
  return key && key.trim() ? key.trim() : 'PROXY_INJECTED';
}

function parseTutorJson(content) {
  try {
    const obj = JSON.parse(content);
    return {
      reply: String(obj.reply || ''),
      correction: String(obj.correction || 'ok'),
      tip: String(obj.tip || ''),
    };
  } catch (_) {
    return { reply: String(content || ''), correction: 'ok', tip: '' };
  }
}

async function runTutorTurn({ task, systemPrompt, learnerText }) {
  const tier = pickTier(task);
  const model = MODEL_BY_TIER[tier];
  const url = `${BASE}/${model}:generateContent`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey(),
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [
        { role: 'user', parts: [{ text: learnerText }] },
      ],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.6 },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`LLM provider ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const content =
    data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') ?? '';
  return { tier, model, ...parseTutorJson(content) };
}

module.exports = { runTutorTurn, MODEL_BY_TIER };
