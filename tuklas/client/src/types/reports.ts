/** Reports of works, comments, messages, events and people (/api/reports, /api/admin/reports). */
import type { UserCard } from './common';

export type ReportTarget = 'work' | 'comment' | 'message' | 'event' | 'user';
export type ReportReason = 'spam' | 'harassment' | 'inappropriate' | 'plagiarism' | 'privacy' | 'other';
export type ReportStatus = 'open' | 'dismissed' | 'actioned';
export type ReportAction = 'dismiss' | 'remove' | 'warn';

/** One reported thing in the admin queue, with every report about it */
export interface ReportItem {
  key: string;
  type: ReportTarget;
  id: number;
  /** What was reported, as it was then (it may have changed or gone since) */
  snapshot: string;
  /** Whose it is, or the person reported */
  owner: UserCard | null;
  exists: boolean;
  /** Already taken down */
  removed: boolean;
  /** Where to look at it; null when admins can't open it (a direct chat) */
  link: string | null;
  status: ReportStatus;
  action: 'remove' | 'warn' | null;
  note: string | null;
  resolvedBy: UserCard | null;
  resolvedAt: string | null;
  reports: { id: number; reporter: UserCard; reason: ReportReason; details: string | null; createdAt: string }[];
}

export interface ReportQueue {
  items: ReportItem[];
  /** Reported things still waiting, for the tab count */
  openCount: number;
}
