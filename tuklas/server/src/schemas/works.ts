/**
 * Works schemas — validate works, submissions, adviser decisions, comments, defense stages and reactions.
 * Exports WorkCard, WorkDetail, MyWork and related view types for the client.
 */
import { z } from 'zod';
import type { Role } from './auth.js';
import type { UserCard } from './common.js';

// ---------- Enums ----------
export const workTypes = ['research', 'literary', 'innovation'] as const;
export type WorkType = (typeof workTypes)[number];

export const workStatuses = ['draft', 'submitted', 'under_review', 'revision', 'approved', 'rejected'] as const;
export type WorkStatus = (typeof workStatuses)[number];

export const reviewDecisions = ['start_review', 'revise', 'approve', 'reject'] as const;
export type ReviewDecision = (typeof reviewDecisions)[number];

export const reactionKinds = ['insightful', 'useful', 'inspiring'] as const;
export type ReactionKind = (typeof reactionKinds)[number];

export const defenseStageKinds = ['proposal', 'colloquium', 'final_defense', 'revisions', 'published'] as const;
export type DefenseStageKind = (typeof defenseStageKinds)[number];

export const verdicts = ['pending', 'passed', 'passed_with_revisions', 'failed'] as const;
export type Verdict = (typeof verdicts)[number];

// ---------- Request schemas ----------
export const workSchema = z.object({
  type: z.enum(workTypes),
  title: z.string().trim().min(5, 'Give the work a title of at least 5 characters').max(180),
  abstract: z.string().trim().min(30, 'Write an abstract of at least 30 characters').max(6000),
  tags: z.array(z.string().trim().min(1).max(40)).max(10, 'Use at most 10 keywords').default([]),
  adviserId: z.number({ error: 'Choose a research adviser' }).int().positive('Choose a research adviser'),
  coAuthorIds: z.array(z.number().int().positive()).max(10, 'Add at most 10 co-authors').default([]),
});
export type WorkInput = z.input<typeof workSchema>;

export const createWorkSchema = workSchema.extend({
  /** false saves a draft; true submits it to the adviser straight away */
  submit: z.boolean().default(false),
});
export type CreateWorkInput = z.input<typeof createWorkSchema>;

export const submitSchema = z.object({ note: z.string().trim().max(500).default('') });

export const decisionSchema = z.object({
  decision: z.enum(reviewDecisions),
  comment: z.string().trim().max(4000).default(''),
  /** Revision checklist: one fix per entry (only with `revise`) */
  items: z.array(z.string().trim().min(1).max(500)).max(20, 'Use at most 20 checklist items').default([]),
});
export type DecisionInput = z.input<typeof decisionSchema>;

export const commentSchema = z.object({ text: z.string().trim().min(1, 'Write something first').max(4000) });

export const itemPatchSchema = z.object({ done: z.boolean().optional(), confirmed: z.boolean().optional() });

export const stageSchema = z.object({
  stage: z.enum(defenseStageKinds),
  date: z.coerce.date({ error: 'Enter the date' }),
  panel: z.string().trim().max(300).default(''),
  verdict: z.enum(verdicts).default('pending'),
  notes: z.string().trim().max(500).default(''),
});
export type StageInput = z.input<typeof stageSchema>;

export const reactionSchema = z.object({ kind: z.enum(reactionKinds) });

export const similarQuery = z.object({
  title: z.string().max(180).default(''),
  keywords: z.string().max(400).default(''),
  exclude: z.coerce.number().int().optional(),
});

// ---------- Response types ----------
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
