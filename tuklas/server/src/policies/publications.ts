/**
 * Publication policies — who can read educator research and what the research library lists.
 */
import type { Publication, User } from '@prisma/client';

type PublicationAccess = Pick<Publication, 'authorId' | 'visibility'> & { coAuthors: { userId: number }[] };

export const isPublicationAuthor = (p: PublicationAccess, u: User | undefined) =>
  Boolean(u && (p.authorId === u.id || p.coAuthors.some((a) => a.userId === u.id)));

/**
 * Who can read educator research. Public: anyone, signed in or not. Internal: anyone signed in to Tuklas.
 * Draft: its authors only. Everyone else gets 404, the same as a missing publication.
 */
export function canSeePublication(p: PublicationAccess, u: User | undefined) {
  if (p.visibility === 'public') return true;
  if (!u) return false;
  return p.visibility === 'internal' || isPublicationAuthor(p, u);
}

/** Prisma filter: what a viewer finds in the research library (published only, never drafts). */
export const libraryWhere = (u: User | undefined) => ({ visibility: u ? { in: ['internal' as const, 'public' as const] } : ('public' as const) });
