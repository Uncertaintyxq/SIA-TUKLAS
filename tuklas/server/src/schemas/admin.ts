/**
 * Admin schemas — validate admin user edits (role, verification, educator rights) and post removals.
 * Also export the admin dashboard response types the client shares: stats, queue, users, educators, posts.
 */
import { z } from 'zod';
import { roles, type EducatorRights, type Role } from './auth.js';
import type { UserCard } from './common.js';
import type { AdCard, EventCard } from './events.js';
import type { HonorView } from './profile.js';
import type { MyWork } from './works.js';

export const userPatchSchema = z.object({
  role: z.enum(roles).optional(),
  verified: z.boolean().optional(),
  /** Educator rights (see src/policies/rights.ts) */
  canPublish: z.boolean().optional(),
  canModerateGroups: z.boolean().optional(),
  canBroadcast: z.boolean().optional(),
});
export type UserPatch = z.input<typeof userPatchSchema>;

export const removeSchema = z.object({ reason: z.string().trim().max(300).default('') });

export interface AdminStats {
  users: Record<Role, number>;
  unverifiedEducators: number;
  works: { published: number; inReview: number; drafts: number; rejected: number; removed: number };
  events: { approved: number; pending: number; registrations: number };
  ads: { live: number; pending: number };
  honorsPending: number;
  groups: number;
  publications: { published: number; drafts: number };
  announcements: number;
}

export interface AdminQueue {
  works: MyWork[];
  educators: (UserCard & { email: string; createdAt: string })[];
  events: EventCard[];
  ads: AdCard[];
  honors: (HonorView & { owner: UserCard })[];
}

export interface AdminUser extends UserCard {
  email: string;
  createdAt: string;
  works: number;
}

/** One educator on the admin's monitoring dashboard. */
export interface EducatorOverview extends UserCard {
  email: string;
  createdAt: string;
  online: boolean;
  lastSeenAt: string | null;
  /** The switches an admin flips (stored values; an unverified educator holds none of them yet) */
  rights: EducatorRights;
  counts: {
    publications: { draft: number; internal: number; public: number };
    groups: number;
    announcements: number;
    reviews: number;
  };
}

export interface EducatorActivity {
  key: string;
  kind: 'publication' | 'announcement' | 'review' | 'group';
  educator: UserCard;
  text: string;
  link: string;
  at: string;
}

export interface AdminEducators {
  educators: EducatorOverview[];
  recent: EducatorActivity[];
}

export interface AdminPosts {
  works: (MyWork & { removedAt: string | null })[];
  opportunities: { id: number; title: string; adviser: UserCard; createdAt: string }[];
  comments: { id: number; text: string; author: UserCard; work: { id: number; title: string }; createdAt: string }[];
}
