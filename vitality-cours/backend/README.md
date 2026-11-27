# VITALITY COURS - Backend

Thin server that holds every API key and streams audio/text between the app and
the AI providers. The Flutter app never talks to an AI provider directly, so a
stolen APK cannot leak keys or spend the owner's money. This is a hard rule.

## Responsibilities

1. `POST /session` - start a tutor session for a (language, level, style) persona.
2. `WS /conversation` - receive the learner's audio stream, run:
   - streaming speech-to-text (STT),
   - the tutor LLM (routed: cheap model for quick corrections, stronger model for
     full conversation - see the cost-aware-llm-pipeline skill),
   - streaming text-to-speech (TTS) back to the app.
3. `POST /pronunciation` - send audio + expected text to the assessment API and
   return per-word and per-phoneme scores. Scores are never invented by the LLM.
4. Record usage so the owner can see cost per day.

## Keys (never committed)

Copy `../.env.example` to `backend/.env` and fill in the owner's OWN keys. The
real `.env` is git-ignored. Keys from any other app must never be used.

## Not built yet

This folder is a placeholder. The server is implemented in a later step, after
the owner creates the free accounts and provides the keys securely (not in chat).
