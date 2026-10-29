/**
 * Group policies — who can open, manage, moderate, organize and announce in a research group.
 * Seats are adviser, mentor, leader or member; admins can act on any group.
 */
import type { GroupRole, User } from '@prisma/client';
import { hasRight } from './rights.js';

/** What the group rules need: who advises the group and who is in it, with their roles. */
export interface GroupAccess {
  adviserId: number;
  members: { userId: number; role: GroupRole }[];
}

export type GroupSeat = 'adviser' | GroupRole;

/** The viewer's seat in the group, or null when they aren't in it (an admin looking in). */
export function seatOf(g: GroupAccess, u: User | undefined): GroupSeat | null {
  if (!u) return null;
  if (g.adviserId === u.id) return 'adviser';
  return g.members.find((m) => m.userId === u.id)?.role ?? null;
}

/** Everyone in the group, adviser first. */
export const participantIds = (g: GroupAccess) => [g.adviserId, ...g.members.map((m) => m.userId)];

/** The adviser, any member, or an admin. Everyone else gets 404. */
export const canOpenGroup = (g: GroupAccess, u: User | undefined) => Boolean(u && (u.role === 'admin' || seatOf(g, u)));

/** Members, roles, settings, channels and deletion: the adviser while they hold the moderation right, or an admin. */
export const canManageGroup = (g: GroupAccess, u: User | undefined) =>
  Boolean(u && (u.role === 'admin' || (g.adviserId === u.id && hasRight(u, 'moderateGroups'))));

/** Removing other people's messages and files: managers, and mentors who hold the moderation right. */
export const canModerateGroup = (g: GroupAccess, u: User | undefined) =>
  canManageGroup(g, u) || (seatOf(g, u) === 'mentor' && hasRight(u, 'moderateGroups'));

/** Deadlines and new channels: moderators and the student group leader. */
export const canOrganizeGroup = (g: GroupAccess, u: User | undefined) => canModerateGroup(g, u) || seatOf(g, u) === 'leader';

/** Group announcements: the adviser or a mentor who holds the broadcast right, or an admin. */
export function canAnnounceToGroup(g: GroupAccess, u: User | undefined) {
  if (u?.role === 'admin') return true;
  const seat = seatOf(g, u);
  return (seat === 'adviser' || seat === 'mentor') && hasRight(u, 'broadcast');
}
