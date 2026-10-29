/**
 * Group schemas — validate research groups, members, member roles and deadlines.
 * Exports GroupSummary, GroupDetail and GroupSeat for the client.
 */
import { z } from 'zod';
import type { UserCard } from './common.js';

export const groupRoles = ['leader', 'member', 'mentor'] as const;
export type GroupRole = (typeof groupRoles)[number];
/** The viewer's place in a group; the adviser owns it. */
export type GroupSeat = 'adviser' | GroupRole;

export const groupSchema = z.object({
  name: z.string().trim().min(3, 'Name the group (3+ characters)').max(120),
  description: z.string().trim().max(1000).default(''),
});
export type GroupInput = z.input<typeof groupSchema>;

export const memberSchema = z.object({ userId: z.number().int().positive() });
export const memberRoleSchema = z.object({ role: z.enum(groupRoles) });

export const deadlineSchema = z.object({
  title: z.string().trim().min(3, 'Describe the deadline').max(160),
  dueAt: z.coerce.date({ error: 'Enter the due date' }),
});
export type DeadlineInput = z.input<typeof deadlineSchema>;

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
