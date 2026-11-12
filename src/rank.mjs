// Re-ranks the embeddings matches. Embeddings are good at meaning but can be a little
// unsteady between runs, so a fault type whose own keywords appear in the report
// ("pothole", "sewage", "streetlight") gets a small bonus. Simple, visible, testable.

export const KEYWORD_BONUS = 0.1; // added per matched keyword
export const MAX_BONUS = 0.2; // never more than this in total

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function keywordHits(type, text) {
  const hits = [];
  for (const keyword of type.keywords ?? []) {
    // "pothole" also matches "potholes": the keyword must start at a word boundary.
    if (new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(keyword)}`, 'iu').test(text)) hits.push(keyword);
  }
  // "leak" and "water leak" are one mention, not two: drop a hit that sits inside another hit.
  return hits.filter((hit) => !hits.some((other) => other !== hit && other.includes(hit)));
}

// candidates: [{ type, score }] from the embeddings search. Returns the same shape,
// sorted best first, with the bonus included in `score` and the raw score kept.
export function rerank(candidates, text) {
  return candidates
    .map(({ type, score }) => {
      const hits = keywordHits(type, text);
      const bonus = Math.min(MAX_BONUS, hits.length * KEYWORD_BONUS);
      return { type, rawScore: score, bonus, hits, score: Math.min(1, score + bonus) };
    })
    .sort((a, b) => b.score - a.score);
}
