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
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
