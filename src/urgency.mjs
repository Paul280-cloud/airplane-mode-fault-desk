// Decides if a report is urgent. Two simple rules, both easy to explain:
//   1. The matched fault type is marked "autoUrgent" in data/fault-types.json.
//   2. The text contains a danger word (checked in English and Spanish).

const DANGER_WORDS = [
  // English
  'sparking',
  'sparks',
  'live wire',
  'exposed wire',
  'electrocut',
  'fallen power line',
  'burst',
  'flooding',
  'flooded',
  'sewage overflow',
  'gas leak',
  'on fire',
  'fire',
  'collapsed',
  'sinkhole',
  'children are at risk',
  'danger',
  'dangerous',
  // Spanish
  'chispas',
  'cable suelto',
  'cable expuesto',
  'inundación',
  'inundando',
  'fuga de gas',
  'incendio',
  'derrumbe',
  'peligro',
  'peligroso',
];

export function evaluateUrgency(texts, faultType) {
  const reasons = [];
  if (faultType?.autoUrgent) {
    reasons.push(`"${faultType.name}" is always marked urgent`);
  }
  const haystack = texts.filter(Boolean).join(' ').toLowerCase();
  const hits = DANGER_WORDS.filter((word) => haystack.includes(word));
  for (const hit of hits) reasons.push(`danger word: "${hit}"`);
  return { urgent: reasons.length > 0, reasons };
}
