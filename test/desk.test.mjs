import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { detectLanguage } from '../src/language.mjs';
import { confidenceLabel, fallbackSummary, groundLocation, runDesk } from '../src/pipeline.mjs';
import { keywordHits, rerank } from '../src/rank.mjs';
import { redact } from '../src/redact.mjs';
import { evaluateUrgency } from '../src/urgency.mjs';

const { faultTypes } = JSON.parse(readFileSync(new URL('../data/fault-types.json', import.meta.url), 'utf8'));
const byId = (id) => faultTypes.find((t) => t.id === id);

// ---- redact ----
test('redact masks South African phone numbers in common formats', () => {
  for (const phone of ['082 555 0134', '0825550134', '+27 82 555 0134', '082-555-0134']) {
    const out = redact(`Call ${phone} please`);
    assert.ok(out.text.includes('[PHONE]'), `missed ${phone}`);
    assert.equal(out.counts.phone, 1, phone);
    assert.ok(!/555/.test(out.text), `still contains digits for ${phone}`);
  }
});

test('redact masks international phones, emails and 13-digit ID numbers', () => {
  const out = redact('Me: +34 612 345 678, a@b.co, ID 9001015800086');
  assert.equal(out.counts.phone, 1);
  assert.equal(out.counts.email, 1);
  assert.equal(out.counts.id_number, 1);
  assert.ok(!out.text.includes('612'));
  assert.ok(!out.text.includes('9001015800086'));
});

test('redact masks names after trigger phrases but keeps the trigger', () => {
  const out = redact('My name is Thandeka Mokoena and I live here. Soy Carlos Ruiz.');
  assert.equal(out.counts.name, 2);
  assert.ok(out.text.includes('My name is [NAME]'));
  assert.ok(out.text.includes('Soy [NAME]'));
  assert.ok(!out.text.includes('Thandeka'));
});

test('redact keeps street addresses and ordinary words', () => {
  const text = 'The street light on 5th Avenue is dark. I am tired of waiting.';
  const out = redact(text);
  assert.equal(out.text, text);
  assert.equal(out.total, 0);
});

// ---- language ----
test('detectLanguage tells English, Spanish and French apart', () => {
  assert.equal(detectLanguage('The street light has been dark since Monday and it is dangerous').language, 'en');
  assert.equal(detectLanguage('La calle lleva tres días sin agua y hay una fuga grande').language, 'es');
  assert.equal(detectLanguage('Il y a une fuite dans la rue depuis trois jours et il est dangereux').language, 'fr');
  assert.equal(detectLanguage('12345 !!!').language, 'unknown');
});

// ---- urgency ----
test('urgency: autoUrgent fault types are always urgent', () => {
  const out = evaluateUrgency(['a wire is hanging'], byId('exposed-live-wire'));
  assert.equal(out.urgent, true);
  assert.match(out.reasons[0], /always marked urgent/);
});

test('urgency: danger words make any fault urgent, in English and Spanish', () => {
  assert.equal(evaluateUrgency(['There is a pothole, very dangerous at night'], byId('pothole')).urgent, true);
  assert.equal(evaluateUrgency(['Hay chispas en el poste'], byId('faulty-streetlight')).urgent, true);
  assert.equal(evaluateUrgency(['The light flickers a bit'], byId('faulty-streetlight')).urgent, false);
});

// ---- pipeline with fake models ----
function fakeAdapters({ type, score = 0.9, summarise } = {}) {
  const calls = { translate: [], match: [] };
  return {
    calls,
    async translateToEnglish(text) {
      calls.translate.push(text);
      return 'There is a big water leak on Liberty Street.';
    },
    async matchFaultType(text) {
      calls.match.push(text);
      return { type: type ?? byId('water-leak'), score, alternatives: [] };
    },
    summarise,
  };
}

test('pipeline masks personal details BEFORE any model sees the text', async () => {
  const adapters = fakeAdapters({ type: byId('faulty-streetlight') });
  const result = await runDesk('Streetlight dark. Call me on 082 555 0134.', adapters, faultTypes);
  assert.equal(result.privacy.maskedItems, 1);
  assert.ok(adapters.calls.match.every((t) => !t.includes('0134')));
  assert.ok(!JSON.stringify(result).includes('0134'));
});

test('pipeline translates Spanish before matching', async () => {
  const adapters = fakeAdapters();
  const result = await runDesk('La calle Libertad lleva tres días sin agua y hay una fuga grande', adapters, faultTypes);
  assert.equal(result.language, 'es');
  assert.equal(result.translated, true);
  assert.equal(adapters.calls.translate.length, 1);
  assert.equal(adapters.calls.match[0], 'There is a big water leak on Liberty Street.');
});

test('pipeline does not translate English', async () => {
  const adapters = fakeAdapters();
  await runDesk('There is a water leak in the street and it has been there since Monday', adapters, faultTypes);
  assert.equal(adapters.calls.translate.length, 0);
});

test('pipeline flags low confidence for human review', async () => {
  const result = await runDesk('Something is wrong with the street', fakeAdapters({ score: 0.2 }), faultTypes);
  assert.equal(result.faultType.confidence, 'low');
  assert.equal(result.needsHumanReview, true);
});

test('pipeline uses the model summary when available', async () => {
  const adapters = fakeAdapters({
    summarise: async () => ({ summary: 'Water leak on Liberty Street.', locationHint: 'Liberty Street' }),
  });
  const result = await runDesk('There is a water leak on Liberty Street and it has been there since Monday', adapters, faultTypes);
  assert.equal(result.summary, 'Water leak on Liberty Street.');
  assert.equal(result.locationHint, 'Liberty Street');
  assert.equal(result.summarySource, 'model');
});

test('pipeline falls back to a simple summary if the language model fails', async () => {
  const adapters = fakeAdapters({
    summarise: async () => {
      throw new Error('bad JSON');
    },
  });
  const result = await runDesk('There is a water leak in the street. It is big.', adapters, faultTypes);
  assert.equal(result.summary, 'There is a water leak in the street.');
  assert.equal(result.summarySource, 'rules');
  assert.ok(result.warnings.some((w) => /Summary model failed/.test(w)));
});

test('location: invented places and placeholders are dropped, real streets are kept', () => {
  const text = "There's a huge pothole on Central Avenue, a car already damaged a wheel.";
  assert.equal(groundLocation('Central Avenue, Washington, D.C.', text), 'Central Avenue');
  assert.equal(groundLocation('Central Avenue', text), 'Central Avenue');
  assert.equal(groundLocation('[NAME] outside my house', 'A live wire hangs outside my house.'), '');
  assert.equal(groundLocation('', 'Sewage on Vilakazi Street is bad.'), 'Vilakazi Street');
  assert.equal(groundLocation('Mars', 'The light is dark.'), '');
});

test('rerank: a keyword in the report beats a slightly higher embeddings score', () => {
  // The real run that went wrong: embeddings preferred "Open manhole" for a pothole report.
  const text = "There's a huge pothole on Central Avenue, a car already damaged a wheel.";
  const ranked = rerank(
    [
      { type: byId('open-manhole'), score: 0.735 },
      { type: byId('pothole'), score: 0.695 },
    ],
    text,
  );
  assert.equal(ranked[0].type.id, 'pothole');
  assert.ok(ranked[0].score > 0.735);
  assert.deepEqual(ranked[0].hits, ['pothole']);
});

test('rerank: plurals match, bonus is capped, score never exceeds 1, no keywords means no change', () => {
  const type = { id: 'x', name: 'X', keywords: ['pothole', 'bache', 'hole', 'road'] };
  const [many] = rerank([{ type, score: 0.95 }], 'potholes and a bache, a hole in the road');
  assert.equal(many.bonus, 0.2);
  assert.equal(many.score, 1);
  const [none] = rerank([{ type: { id: 'y', name: 'Y' }, score: 0.5 }], 'anything');
  assert.equal(none.score, 0.5);
  assert.equal(keywordHits(byId('pothole'), 'The potholes are bad').length, 1);
  assert.equal(keywordHits(byId('pothole'), 'The road is fine').length, 0);
});

test('helpers', () => {
  assert.equal(confidenceLabel(0.9), 'high');
  assert.equal(confidenceLabel(0.6), 'medium');
  assert.equal(confidenceLabel(0.1), 'low');
  assert.equal(fallbackSummary('One. Two.'), 'One.');
});

test('fault types file is valid', () => {
  const ids = new Set();
  for (const t of faultTypes) {
    assert.ok(t.id && t.name && t.category && t.description, t.id);
    assert.ok(!ids.has(t.id), `duplicate id ${t.id}`);
    ids.add(t.id);
  }
  assert.ok(faultTypes.filter((t) => t.autoUrgent).length >= 1);
});
