# VITALITY COURS - Backend

Thin, dependency-free Node server that holds every API key and connects the app
to the AI providers. The Flutter app never talks to a provider directly, so a
stolen APK cannot leak keys or spend the owner's money. Hard rule.

## Run it

```bash
cd backend
npm start          # starts on http://localhost:8080
npm test           # runs the test suite (no keys needed)
```

With no keys set, every provider runs in **mock mode**: the whole app works for
testing, but replies are fake. Add the owner's own keys in `.env` (see
`../.env.example`) to go live.

## Endpoints

| Method + path | What it does |
|---|---|
| `GET /health` | Status + which providers are live vs mock |
| `POST /session` | Validate (language, level, style) and return the tutor prompt |
| `POST /tutor-turn` | Run one tutor turn (routed LLM); mock-safe without keys |
| `POST /pronunciation` | Pronunciation score per word |

Streaming voice (STT in, TTS out over WebSocket) and the live provider adapters
are the next step, added once the owner's keys are in place.

## How "plizyè IA" works

`src/router.js` routes each task to a tier: a small fast model for quick
corrections, a standard model for conversation, a large model for detailed
feedback. Swapping providers never changes this routing. See the
cost-aware-llm-pipeline skill.

## Files

- `src/personaPrompt.js` - builds the tutor's hidden prompt from persona data
- `src/router.js` - task -> model tier routing
- `src/providers/index.js` - LLM / STT / TTS / pronunciation adapters (mock + live)
- `src/server.js` - the HTTP server
- `test/run.js` - tests (run with `npm test`)
