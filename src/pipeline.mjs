// The Fault Desk steps, in order:
//   1. Mask personal details (rules)          -> models never see them
//   2. Guess the language (rules)
//   3. Spanish -> English (local Bergamot model)
//   4. Match the closest fault type (local embeddings model)
//   5. Urgent? (rules + the fault type's flag)
//   6. Short summary + location (local language model, strict JSON)
// The AI parts are passed in as "adapters", so the steps can be tested without models.

import { detectLanguage } from './language.mjs';
import { redact } from './redact.mjs';
import { evaluateUrgency } from './urgency.mjs';

export const THRESHOLDS = { high: 0.75, low: 0.55 }; // tune on your machine (see README)

export function confidenceLabel(score, thresholds = THRESHOLDS) {
  if (score >= thresholds.high) return 'high';
  if (score >= thresholds.low) return 'medium';
  return 'low';
}

// Used when the language model is off or fails: first sentence, trimmed.
export function fallbackSummary(text) {
  const first = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? '';
  return first.length > 140 ? `${first.slice(0, 137)}...` : first;
}

const STREET = /\b(?:on|at|near|in|outside|opposite)\s+((?:[A-Z0-9][\w'’-]*\s+){0,3}(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Lane|Crescent|Close|Way|Boulevard)\b)/;

function wordsOf(text) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

// A small model can invent places ("Washington, D.C."). Keep its location only if every
// word of it appears in the report. Otherwise look for a street name in the report itself.
export function groundLocation(hint, text) {
  const clean = String(hint ?? '').trim();
  if (clean && !clean.includes('[')) {
    const known = new Set(wordsOf(text));
    if (wordsOf(clean).every((word) => known.has(word))) return clean;
  }
  return text.match(STREET)?.[1].trim() ?? '';
}

export async function runDesk(rawText, adapters, faultTypes, options = {}) {
  const started = Date.now();
  const warnings = [];
  const thresholds = options.thresholds ?? THRESHOLDS;

  const redaction = redact(rawText);
  const { language } = detectLanguage(redaction.text);

  let english = redaction.text;
  let translated = false;
  if (language === 'es') {
    english = await adapters.translateToEnglish(redaction.text);
    translated = true;
  } else if (language === 'fr') {
    warnings.push('French input is not translated: this SDK has no French-to-English model. Matching may be less accurate.');
  } else if (language === 'unknown') {
    warnings.push('Language not recognised; treated as English.');
  }

  const match = await adapters.matchFaultType(english, faultTypes);
  const confidence = confidenceLabel(match.score, thresholds);
  const needsReview = confidence === 'low';
  if (needsReview) warnings.push('Low confidence: a person should check the fault type.');

  const urgency = evaluateUrgency([english, redaction.text], match.type);

  let details = { summary: '', locationHint: '', source: 'rules' };
  if (adapters.summarise) {
    try {
      const out = await adapters.summarise(english);
      details = { summary: out.summary, locationHint: out.locationHint, source: 'model' };
    } catch (error) {
      warnings.push(`Summary model failed (${error.message ?? error}); used a simple summary.`);
    }
  }
  if (!details.summary) details = { ...details, summary: fallbackSummary(english), source: 'rules' };
  details.locationHint = groundLocation(details.locationHint, english);

  return {
    language,
    translated,
    privacy: { maskedItems: redaction.total, counts: redaction.counts },
    reportMasked: redaction.text,
    reportEnglish: english,
    faultType: {
      id: match.type.id,
      name: match.type.name,
      category: match.type.category,
      score: Number(match.score.toFixed(3)),
      confidence,
      alternatives: (match.alternatives ?? []).map((a) => ({
        name: a.type.name,
        score: Number(a.score.toFixed(3)),
      })),
    },
    urgent: urgency.urgent,
    urgentReasons: urgency.reasons,
    summary: details.summary,
    locationHint: details.locationHint,
    summarySource: details.source,
    needsHumanReview: needsReview,
    warnings,
    elapsedMs: Date.now() - started,
  };
}
