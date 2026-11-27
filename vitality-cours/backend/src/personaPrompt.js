'use strict';

// Builds the tutor's hidden system prompt from a persona (data from the app).
// Pure function, no secrets, no network: fully unit-testable.

const LANGUAGE_NAMES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
};

function resolveLabel(localized, lang) {
  if (!localized || typeof localized !== 'object') return '';
  return localized[lang] || localized.en || Object.values(localized)[0] || '';
}

/**
 * @param {object} args
 * @param {string} args.targetLanguage - "en" | "es" | "fr"
 * @param {object} args.level - a level object from personas.json
 * @param {object} args.style - a style object from personas.json
 * @param {string} [args.uiLang] - language for human-readable labels (default "en")
 * @returns {string} system prompt
 */
function buildTutorPrompt({ targetLanguage, level, style, uiLang = 'en' }) {
  if (!LANGUAGE_NAMES[targetLanguage]) {
    throw new Error(`Unsupported target language: ${targetLanguage}`);
  }
  if (!level || !style) {
    throw new Error('buildTutorPrompt requires both level and style');
  }

  const languageName = LANGUAGE_NAMES[targetLanguage];
  const levelLabel = resolveLabel(level.label, uiLang) || level.id;
  const styleLabel = resolveLabel(style.label, uiLang) || style.id;
  const topics = Array.isArray(style.topics) ? style.topics.join(', ') : '';

  return [
    `You are a friendly, patient language tutor in the VITALITY COURS app.`,
    `Target language: ${languageName}. Speak only in ${languageName} for the conversation itself.`,
    `Learner level: ${levelLabel}. Speak at rate ${level.speakingRate}, and keep each sentence under ${level.sentenceMaxWords} words.`,
    `Conversation style: ${styleLabel}. Goal: ${style.goal}`,
    topics ? `Suggested topics: ${topics}.` : '',
    `Keep every reply short so the learner does most of the talking.`,
    `Return a JSON object with three fields:`,
    `  "reply": your natural next line in ${languageName},`,
    `  "correction": a short correction of the learner's last sentence, or "ok" if it was correct,`,
    `  "tip": one short encouraging tip.`,
    `Correction strictness: ${level.correctionStrictness}.`,
    `Never invent pronunciation scores; those come from a separate assessment service.`,
    `Be encouraging. Never shame the learner.`,
  ]
    .filter(Boolean)
    .join('\n');
}

module.exports = { buildTutorPrompt, resolveLabel, LANGUAGE_NAMES };
