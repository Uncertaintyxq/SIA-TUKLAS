/** Research groups (/api/groups). */
import type { UserCard } from './common';

export type GroupRole = 'leader' | 'member' | 'mentor';
/** The viewer's place in a group; the adviser owns it. */
export type GroupSeat = 'adviser' | GroupRole;

export interface GroupInput {
  /** 3+ characters */
  name: string;
  description?: string;
}

/** What a deadline collects: nothing (a reminder), one submission per student, or one for the group. */
export type SubmissionMode = 'none' | 'each' | 'group';
export type SubmissionStatus = 'submitted' | 'needs_revision' | 'accepted';

export interface DeadlineInput {
  title: string;
  dueAt: string | Date;
  submissionMode?: SubmissionMode;
  instructions?: string;
}

export interface GroupDeadline {
  id: number;
  title: string;
  dueAt: string;
  submissionMode: SubmissionMode;
  instructions: string;
  /** Deliverables, for the group's students: where theirs (or the group's) stands. null = not handed in */
  myStatus?: SubmissionStatus | null;
  /** Deliverables, for reviewers: how many handed in, out of how many expected */
  handedIn?: number | null;
  expected?: number | null;
}

/** An earlier version of a submission, with the review it got. */
export interface DeliverableVersion {
  version: number;
  name: string;
  size: number;
  fileUrl: string;
  note: string | null;
  status: SubmissionStatus;
  late: boolean;
  submittedAt: string;
  submittedBy: UserCard | null;
  feedback: string | null;
  reviewedBy: UserCard | null;
  reviewedAt: string | null;
}

/** Work handed in against a deliverable. A group deliverable has one, shared by its students. */
export interface DeliverableSubmission {
  id: number;
  name: string;
  size: number;
  type: string;
  fileUrl: string;
  note: string | null;
  /** How many times it was handed in */
  version: number;
  status: SubmissionStatus;
  late: boolean;
  submittedAt: string;
  submittedBy: UserCard;
  feedback: string | null;
  reviewedBy: UserCard | null;
  reviewedAt: string | null;
  /** Earlier versions, newest first */
  history: DeliverableVersion[];
}

export interface DeliverableDetail {
  id: number;
  title: string;
  dueAt: string;
  submissionMode: SubmissionMode;
  instructions: string;
  can: { submit: boolean; review: boolean };
  /** The viewer's own submission, or their group's */
  mine: DeliverableSubmission | null;
  /** Reviewers only */
  submissions?: DeliverableSubmission[];
  /** Reviewers only: students who haven't handed in */
  missing?: UserCard[];
}

export interface GroupSummary {
  id: number;
  name: string;
  description: string;
  adviser: UserCard;
  memberCount: number;
  fileCount: number;
  nextDeadline: { title: string; dueAt: string } | null;
  isAdviser: boolean;
  /** null when an admin looks in without being part of it */
  mySeat: GroupSeat | null;
}

export interface GroupDetail extends GroupSummary {
  /** groupRole is their place in the group; role stays their account role */
  members: (UserCard & { addedAt: string; groupRole: GroupRole })[];
  files: { id: number; name: string; size: number; type: string; uploadedBy: UserCard; createdAt: string; canDelete: boolean }[];
  deadlines: GroupDeadline[];
  channels: { id: number; name: string; unread: number; lastMessageAt: string }[];
  activity: { id: number; action: string; detail: string; actor: UserCard; createdAt: string }[];
  can: {
    /** Members, roles, settings, channels, deletion */
    manage: boolean;
    /** Remove other people's messages and files */
    moderate: boolean;
    /** Add deadlines and channels */
    organize: boolean;
    /** Post group announcements */
    announce: boolean;
    /** See every deliverable submission and give feedback */
    review: boolean;
    /** Hand in deliverables (the group's students) */
    submit: boolean;
  };
}
