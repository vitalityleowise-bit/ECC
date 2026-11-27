'use strict';

// Live OpenAI adapter for the tutor LLM. One account can later also cover
// speech-to-text and text-to-speech. The key is read from the environment on a
// real server; in this session it is injected securely by the proxy, so the
// Authorization header value here is a placeholder, never a real secret.

const { pickTier } = require('../router');

const ENDPOINT = 'https://api.openai.com/v1/chat/completions';

// Logical tier -> OpenAI model. Cheap model for quick work, stronger for depth.
const MODEL_BY_TIER = {
  small: process.env.OPENAI_MODEL_SMALL || 'gpt-4o-mini',
  standard: process.env.OPENAI_MODEL_STANDARD || 'gpt-4o-mini',
  large: process.env.OPENAI_MODEL_LARGE || 'gpt-4o',
};

function authHeader() {
  const key = process.env.OPENAI_API_KEY;
  // On a real server OPENAI_API_KEY is set. In this session the proxy replaces
  // the header, so a placeholder is enough and no real key is ever in code.
  return `Bearer ${key && key.trim() ? key.trim() : 'PROXY_INJECTED'}`;
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
    // Model did not return clean JSON: use the whole text as the reply.
    return { reply: String(content || ''), correction: 'ok', tip: '' };
  }
}

async function runTutorTurn({ task, systemPrompt, learnerText }) {
  const tier = pickTier(task);
  const model = MODEL_BY_TIER[tier];

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authHeader(),
    },
    body: JSON.stringify({
      model,
      temperature: 0.6,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: learnerText },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    // Never echo auth headers; only status + provider message.
    throw new Error(`LLM provider ${response.status}: ${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return { tier, model, ...parseTutorJson(content) };
}

module.exports = { runTutorTurn, MODEL_BY_TIER };
