/** APA 7 and MLA 9 citations for student works and educator research. */
import type { PublicationCard } from '../types/publications';
import type { WorkCard } from '../types/works';
import { typeLabel } from './labels';

/** What a citation needs, whichever kind of item it cites. */
export interface CiteSource {
  authors: { name: string }[];
  title: string;
  /** Approval or publication date; null prints "n.d." */
  date: string | null;
  /** The bracketed description in APA, e.g. "Research paper" */
  medium: string;
  /** Path on Tuklas, e.g. /works/12 */
  path: string;
}

export const workSource = (w: WorkCard): CiteSource => ({ authors: w.authors, title: w.title, date: w.approvedAt, medium: typeLabel[w.type], path: `/works/${w.id}` });

export const publicationSource = (p: PublicationCard): CiteSource => ({
  authors: p.authors,
  title: p.title,
  date: p.publishedAt,
  medium: 'Research article',
  path: `/publications/${p.id}`,
});

// Surname particles that belong to the family name: "Kim Dela Cruz" → "Dela Cruz".
const PARTICLES = new Set(['de', 'dela', 'del', 'delos', 'de los', 'la', 'los', 'san', 'santa', 'van', 'von', 'da', 'di']);

/** Splits a display name into given names and family name, dropping honorifics. */
function splitName(full: string) {
  const words = full.replace(/^(Dr\.|Prof\.|Engr\.|Atty\.)\s*/i, '').trim().split(/\s+/);
  let cut = words.length - 1;
  while (cut > 1 && PARTICLES.has(words[cut - 1]!.toLowerCase())) cut--;
  return { given: words.slice(0, cut), family: words.slice(cut).join(' ') };
}

const initialsOf = (given: string[]) => given.map((g) => `${g[0]!.toUpperCase()}.`).join(' ');

/** "Villanueva, A." */
const apaName = (full: string) => {
  const { given, family } = splitName(full);
  return given.length ? `${family}, ${initialsOf(given)}` : family;
};

/** One citation as styled runs, so the title can be italic on screen and plain when copied. */
export interface Citation {
  parts: { text: string; italic?: boolean }[];
  plain: string;
}

const build = (parts: Citation['parts']): Citation => ({ parts, plain: parts.map((p) => p.text).join('') });

const urlOf = (s: CiteSource) => `${window.location.origin}${s.path}`;

/** APA 7th edition. */
export function apa(w: CiteSource): Citation {
  const names = w.authors.map((a) => apaName(a.name));
  const authors =
    names.length === 1
      ? names[0]!
      : names.length === 2
        ? `${names[0]}, & ${names[1]}`
        : `${names.slice(0, -1).join(', ')}, & ${names.at(-1)}`;
  const year = w.date ? new Date(w.date).getFullYear() : 'n.d.';
  return build([{ text: `${authors} (${year}). ` }, { text: w.title, italic: true }, { text: ` [${w.medium}]. Tuklas. ${urlOf(w)}` }]);
}

const MONTHS = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** MLA 9th edition. */
export function mla(w: CiteSource): Citation {
  const first = splitName(w.authors[0]!.name);
  const lead = first.given.length ? `${first.family}, ${first.given.join(' ')}` : first.family;
  const second = w.authors[1]?.name.replace(/^(Dr\.|Prof\.|Engr\.|Atty\.)\s*/i, '');
  const authors = w.authors.length === 1 ? lead : w.authors.length === 2 ? `${lead}, and ${second}` : `${lead}, et al`;
  const d = w.date ? new Date(w.date) : null;
  const date = d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'n.d.';
  return build([{ text: `${authors}. ` }, { text: w.title, italic: true }, { text: `. Tuklas, ${date}, ${urlOf(w).replace(/^https?:\/\//, '')}.` }]);
}
