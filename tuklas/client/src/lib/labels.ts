/**
 * Labels — the display text (and some badge tones) for every enum the server sends.
 * Keyed by the server's schema types, so a new enum value fails the type check until it gets a label.
 */
import type { UserCard } from '../types/common';
import type { ApprovalStatus, EventCategory } from '../types/events';
import type { BadgeTone } from '../components/ui/Badge';
import type { OpportunityKind } from '../types/feed';
import type { HonorKind, LinkType } from '../types/profile';
import type { DefenseStageKind, ReactionKind, ReviewDecision, Verdict, WorkStatus, WorkType } from '../types/works';

export const typeLabel: Record<WorkType, string> = { research: 'Research paper', literary: 'Literary work', innovation: 'Innovation' };

export const statusLabel: Record<WorkStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  under_review: 'Under review',
  revision: 'Needs revision',
  approved: 'Approved',
  rejected: 'Not approved',
};

export const decisionLabel: Record<ReviewDecision, string> = {
  start_review: 'Started the review',
  revise: 'Returned with comments',
  approve: 'Approved',
  reject: 'Marked not approved',
};

export const reactionLabel: Record<ReactionKind, string> = { insightful: 'Insightful', useful: 'Useful', inspiring: 'Inspiring' };

export const stageLabel: Record<DefenseStageKind, string> = {
  proposal: 'Proposal defense',
  colloquium: 'Colloquium',
  final_defense: 'Final defense',
  revisions: 'Revisions',
  published: 'Published',
};

export const verdictLabel: Record<Verdict, string> = {
  pending: 'Scheduled',
  passed: 'Passed',
  passed_with_revisions: 'Passed with revisions',
  failed: 'Did not pass',
};

export const categoryLabel: Record<EventCategory, string> = {
  colloquium: 'Research colloquium',
  defense: 'Thesis defense',
  fair: 'Research fair',
  innovation: 'School innovation',
  cpgarcia: 'C.P. Garcia event',
};

export const approvalLabel: Record<ApprovalStatus, string> = { pending: 'Awaiting admin approval', approved: 'Approved', rejected: 'Not approved' };
export const approvalTone: Record<ApprovalStatus, BadgeTone> = { pending: 'gold', approved: 'ok', rejected: 'bad' };

export const opportunityLabel: Record<OpportunityKind, string> = { mentorship: 'Mentorship', grant: 'Research grant', call: 'Call for submissions' };

export const linkLabel: Record<LinkType, string> = {
  scholar: 'Google Scholar',
  orcid: 'ORCID',
  researchgate: 'ResearchGate',
  linkedin: 'LinkedIn',
  faculty: 'Faculty page',
  other: 'Website',
};

export const honorLabel: Record<HonorKind, string> = { award: 'Award', grant: 'Grant', certification: 'Certification' };

/** The role badge on profiles: educators read "Verified Educator" once an admin confirms them. */
export function roleBadge(u: Pick<UserCard, 'role' | 'verified'>) {
  if (u.role === 'educator') return u.verified ? 'Verified Educator' : 'Educator · unverified';
  return u.role === 'admin' ? 'Admin' : 'Student';
}
