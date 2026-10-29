// Topic overlap: compares a draft's title and keywords with approved works, so a student sees
// similar theses early. Plain term overlap is enough at one school's scale.

const STOP = new Set(
  (
    'about above after again against also among analysis and any approach are assessment based being between both but can case ' +
    'during each effect effects evaluation for from further how into its more most new not of off once only other our over own ' +
    'same should some study such than that the their them then there these they this those through toward towards under until ' +
    'use used using very via was were what when where which while who why will with within without'
  ).split(' '),
);

/** Lowercase content words, accents folded, light plural stripping ("networks" → "network"). */
export function terms(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map((w) => (w.length > 4 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w));
  return [...new Set(words)];
}

interface Candidate {
  title: string;
  tags: string[];
  abstract: string;
}

/** Title and keyword hits count double; abstract hits add a little. Returns the score and shared terms. */
export function overlap(query: string[], work: Candidate) {
  const q = new Set(query);
  const title = terms(work.title).filter((t) => q.has(t));
  const tags = terms(work.tags.join(' ')).filter((t) => q.has(t));
  const abstract = terms(work.abstract).filter((t) => q.has(t));
  const shared = [...new Set([...title, ...tags, ...abstract])];
  return { score: title.length * 2 + tags.length * 2 + Math.min(abstract.length, 4) * 0.5, shared };
}
