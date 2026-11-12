// Tiny offline language guess for short reports: English, Spanish or French.
// It counts common words. It is a guide, not a promise: very short texts may be "unknown".

const WORDS = {
  en: 'the and is are was has have had on in at for since with it there not my from been this that to of a an very no'.split(' '),
  es: 'el la los las de en y que es un una por con hay desde no se del esta está lleva mi al muy hace fuera sin'.split(' '),
  fr: 'le la les des est une un dans pour avec depuis ne pas sur qui il elle mon ma que et du au très'.split(' '),
};

function words(text) {
  return text.toLowerCase().match(/[a-zà-ÿ']+/g) ?? [];
}

export function detectLanguage(text) {
  const tokens = words(text);
  const scores = { en: 0, es: 0, fr: 0 };
  for (const token of tokens) {
    for (const lang of Object.keys(WORDS)) {
      if (WORDS[lang].includes(token)) scores[lang] += 1;
    }
  }
  const ranked = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [best, bestScore] = ranked[0];
  const secondScore = ranked[1][1];
  if (bestScore === 0) return { language: 'unknown', scores };
  if (bestScore === secondScore) return { language: 'unknown', scores };
  return { language: best, scores };
}
