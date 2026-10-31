/** Student works, from draft to the public library (/api/works). */
import type { Role } from './auth';
import type { UserCard } from './common';

export type WorkType = 'research' | 'literary' | 'innovation';
export type WorkStatus = 'draft' | 'submitted' | 'under_review' | 'revision' | 'approved' | 'rejected';
export type ReviewDecision = 'start_review' | 'revise' | 'approve' | 'reject';
export type ReactionKind = 'insightful' | 'useful' | 'inspiring';
export type DefenseStageKind = 'proposal' | 'colloquium' | 'final_defense' | 'revisions' | 'published';
export type Verdict = 'pending' | 'passed' | 'passed_with_revisions' | 'failed';

// ---------- Requests ----------

export interface WorkInput {
  type: WorkType;
  title: string;
  abstract: string;
  /** At most 10 keywords */
  tags?: string[];
  adviserId: number;
  /** At most 10 */
  coAuthorIds?: number[];
}

export interface CreateWorkInput extends WorkInput {
  /** false saves a draft; true submits it to the adviser straight away */
  submit?: boolean;
}

export interface DecisionInput {
  decision: ReviewDecision;
  comment?: string;
  /** Revision checklist: one fix per entry (only with "revise") */
  items?: string[];
}

export interface StageInput {
  stage: DefenseStageKind;
  date: string | Date;
  panel?: string;
  verdict?: Verdict;
  notes?: string;
}

// ---------- Responses ----------

/** Who approved a work and when: a plain record, shown as text. */
export interface Approval {
  approvedAt: string;
  approverName: string;
  approverRole: Role;
}

/** A work as lists show it. Private fields stay off until the viewer may see them. */
export interface WorkCard {
  id: number;
  type: WorkType;
  title: string;
  abstract: string;
  tags: string[];
  status: WorkStatus;
  /** Submitting author first, then co-authors in byline order */
  authors: UserCard[];
  adviser: UserCard;
  department: string;
  approvedAt: string | null;
  approval: Approval | null;
  removed: boolean;
  commentCount: number;
  reactionCount: number;
  myReaction: ReactionKind | null;
  saved: boolean;
}

export interface RevisionItemView {
  id: number;
  text: string;
  done: boolean;
  confirmed: boolean;
}

export interface ReviewView {
  id: number;
  reviewer: UserCard;
  decision: ReviewDecision;
  comment: string | null;
  version: number;
  createdAt: string;
  items: RevisionItemView[];
}

export interface VersionView {
  version: number;
  title: string;
  note: string;
  submittedAt: string;
  pdfName: string | null;
}

export interface StageView {
  id: number;
  stage: DefenseStageKind;
  date: string;
  panel: string;
  verdict: Verdict;
  notes: string;
}

export interface CommentView {
  id: number;
  author: UserCard;
  text: string;
  createdAt: string;
  canDelete: boolean;
}

export interface WorkDetail extends WorkCard {
  pdfName: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Private: only authors, the adviser and admins get versions, reviews and the review thread. */
  versions: VersionView[];
  reviews: ReviewView[];
  thread: CommentView[];
  /** Public discussion, once approved */
  discussion: CommentView[];
  stages: StageView[];
  reactions: Record<ReactionKind, number>;
  openItems: number;
  can: {
    edit: boolean;
    submit: boolean;
    delete: boolean;
    decide: ReviewDecision[];
    comment: boolean;
    manageStages: boolean;
    tickItems: boolean;
    confirmItems: boolean;
    discuss: boolean;
  };
}

export interface MyWork extends WorkCard {
  createdAt: string;
  updatedAt: string;
  submittedAt: string | null;
  versionCount: number;
  hasPdf: boolean;
  isOwner: boolean;
  openItems: number;
  latestReview: { decision: ReviewDecision; comment: string | null; reviewerName: string; createdAt: string } | null;
}

export interface SimilarWork {
  id: number;
  title: string;
  type: WorkType;
  authors: string[];
  year: number;
  shared: string[];
}
