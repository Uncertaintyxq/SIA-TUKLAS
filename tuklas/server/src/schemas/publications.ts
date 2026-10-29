/**
 * Publication schemas — validate educator research publications and the publications search query.
 * Exports PublicationCard and PublicationDetail for the client.
 */
import { z } from 'zod';
import type { UserCard } from './common.js';

export const publicationVisibilities = ['draft', 'internal', 'public'] as const;
export type PublicationVisibility = (typeof publicationVisibilities)[number];

export const publicationSchema = z.object({
  title: z.string().trim().min(5, 'Give the research a title of at least 5 characters').max(200),
  abstract: z.string().trim().min(30, 'Write an abstract of at least 30 characters').max(6000),
  keywords: z.array(z.string().trim().min(1).max(40)).max(10, 'Use at most 10 keywords').default([]),
  methodology: z.string().trim().max(20000, 'Keep the methodology under 20,000 characters').default(''),
  fullText: z.string().trim().max(200000, 'The full text is too long; attach it as a PDF instead').default(''),
  coAuthorIds: z.array(z.number().int().positive()).max(10, 'Add at most 10 co-authors').default([]),
  visibility: z.enum(publicationVisibilities).default('draft'),
});
export type PublicationInput = z.input<typeof publicationSchema>;

export const publicationsQuery = z.object({ q: z.string().trim().max(80).catch('') });

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
