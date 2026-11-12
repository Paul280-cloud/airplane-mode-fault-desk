// Masks personal details BEFORE any model sees the text.
// Rules only (no AI), so the result is predictable and easy to explain.
// Street addresses are kept on purpose: a fault report needs to say where the fault is.

const NAME_WORD = "[A-ZÀ-Ý][a-zà-ÿ'’-]+";
const NAME = `${NAME_WORD}(?:\\s+${NAME_WORD}){0,2}`;
const TRIGGERS = [
  'my name is',
  'My name is',
  'I am',
  "I'm",
  'This is',
  'name:',
  'Name:',
  'call',
  'Call',
  'ask for',
  'Ask for',
  'contact',
  'Contact',
  'me llamo',
  'Me llamo',
  'soy',
  'Soy',
  'llamar a',
  'llame a',
  'Llame a',
].join('|');

const RULES = [
  { kind: 'email', token: '[EMAIL]', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { kind: 'id_number', token: '[ID NUMBER]', re: /\b\d{13}\b/g },
  // South African numbers: 082 555 0134, 0825550134, +27 82 555 0134, 0027...
  { kind: 'phone', token: '[PHONE]', re: /(?:\+27|0027|\b0)[\s-]?\d{2}[\s-]?\d{3}[\s-]?\d{4}\b/g },
  // Other international numbers: +34 612 345 678, +33 6 12 34 56 78
  { kind: 'phone', token: '[PHONE]', re: /\+\d{1,3}(?:[\s-]?\d{2,4}){2,4}\b/g },
];

export function redact(input) {
  let text = String(input ?? '');
  const counts = { email: 0, id_number: 0, phone: 0, name: 0 };

  for (const rule of RULES) {
    text = text.replace(rule.re, () => {
      counts[rule.kind] += 1;
      return rule.token;
    });
  }

  const nameRule = new RegExp(`\\b(${TRIGGERS})\\s+(${NAME})`, 'g');
  text = text.replace(nameRule, (_all, trigger) => {
    counts.name += 1;
    return `${trigger} [NAME]`;
  });

  const total = counts.email + counts.id_number + counts.phone + counts.name;
  return { text, counts, total };
}
