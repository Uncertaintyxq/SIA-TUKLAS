/** Educator research and the research library (/api/publications). */
import type { UserCard } from './common';

export type PublicationVisibility = 'draft' | 'internal' | 'public';

export interface PublicationInput {
  title: string;
  abstract: string;
  /** At most 10 */
  keywords?: string[];
  methodology?: string;
  fullText?: string;
  /** At most 10 */
  coAuthorIds?: number[];
  visibility?: PublicationVisibility;
}

/** A publication as lists show it. */
export interface PublicationCard {
  id: number;
  title: string;
  abstract: string;
  keywords: string[];
  visibility: PublicationVisibility;
  /** Main author first, then co-authors in byline order */
  authors: UserCard[];
  department: string;
  hasPdf: boolean;
  /** Reach: each reader counts once a day; only grows once it's published */
  views: number;
  downloads: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Library filters ('' = any) */
export interface LibraryParams {
  q: string;
  year: string;
  dept: string;
  keyword: string;
}

/** What the library can be browsed by (GET /api/publications/browse) */
export interface LibraryBrowse {
  departments: { name: string; research: number; works: number }[];
  years: number[];
  keywords: { name: string; count: number }[];
}

export interface PublicationDetail extends PublicationCard {
  methodology: string;
  fullText: string;
  pdfName: string | null;
  can: {
    edit: boolean;
    delete: boolean;
    /** Holds the publishing right, so may choose Internal or Public */
    publish: boolean;
  };
}
