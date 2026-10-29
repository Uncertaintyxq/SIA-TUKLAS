/**
 * Work policies — visibility, review and edit rules for student works, plus the review status flow.
 * A work is public only once approved and not removed; everyone else who can't see it gets 404.
 */
import type { User, Work } from '@prisma/client';
import type { ReviewDecision, WorkStatus } from '../schemas/works.js';

type WorkAccess = Pick<Work, 'authorId' | 'adviserId' | 'status' | 'removedAt'> & { coAuthors: { userId: number }[] };

/** Rule 1 of the plan: a work is public only once approved, and only while an admin hasn't removed it. */
export const isPublic = (w: Pick<Work, 'status' | 'removedAt'>) => w.status === 'approved' && !w.removedAt;

/** Prisma filter with the same meaning, for queries that list public works. */
export const publicWork = { status: 'approved', removedAt: null } as const;

export const isAuthor = (w: WorkAccess, u: User | undefined) =>
  Boolean(u && (w.authorId === u.id || w.coAuthors.some((a) => a.userId === u.id)));

/**
 * Who can see a work. Everyone else gets 404, the same as a missing work, so its existence doesn't leak.
 * Drafts are the authors' alone; from submission on, the adviser and admins see it too.
 */
export function canSeeWork(w: WorkAccess, u: User | undefined): boolean {
  if (isPublic(w)) return true;
  if (!u) return false;
  if (isAuthor(w, u)) return true;
  if (w.status === 'draft') return false;
  return w.adviserId === u.id || u.role === 'admin';
}

/** Can review: the assigned adviser once verified, or an admin acting as the panel. Never on your own work. */
export function canReview(w: WorkAccess, u: User | undefined): boolean {
  if (!u || isAuthor(w, u)) return false;
  if (u.role === 'admin') return true;
  return u.role === 'educator' && u.verified && w.adviserId === u.id;
}

/** Allowed decisions from each status. `approved` and `rejected` are final. */
export const allowedDecisions: Record<WorkStatus, ReviewDecision[]> = {
  draft: [],
  submitted: ['start_review', 'revise', 'approve', 'reject'],
  under_review: ['revise', 'approve', 'reject'],
  revision: ['approve', 'reject'],
  approved: [],
  rejected: [],
};

/** The status a work moves to after each review decision. */
export const statusAfter:Record<ReviewDecision, WorkStatus> = {
  start_review: 'under_review',
  revise: 'revision',
  approve: 'approved',
  reject: 'rejected',
};

/** Only the submitting author edits and submits, and only while the work is a draft or sent back. */
export const canEdit = (w: Pick<Work, 'authorId' | 'status'>, u: User | undefined) =>
  Boolean(u && w.authorId === u.id && (w.status === 'draft' || w.status === 'revision'));
