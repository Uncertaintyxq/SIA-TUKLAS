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

export interface DeadlineInput {
  title: string;
  dueAt: string | Date;
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
  deadlines: { id: number; title: string; dueAt: string }[];
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
  };
}
