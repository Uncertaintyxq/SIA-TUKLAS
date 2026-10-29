/**
 * Announcement schemas — validate new and edited announcements and the list query.
 * Exports AnnouncementView, AnnouncementsResponse and ReceiptsView for the client.
 */
import { z } from 'zod';
import type { UserCard } from './common.js';

export const announcementScopes = ['system', 'department', 'group'] as const;
export type AnnouncementScope = (typeof announcementScopes)[number];

const fields = {
  title: z.string().trim().min(3, 'Give the announcement a title').max(160),
  /** Light markup: **bold**, _italic_, "## " headings, "- " and "1. " lists, [text](https://…) links */
  body: z.string().trim().min(1, 'Write the announcement').max(10000, 'Keep it under 10,000 characters'),
  pinned: z.boolean().default(false),
};

export const announcementSchema = z.object({
  scope: z.enum(announcementScopes),
  /** department scope: which department (admins pick; educators always post to their own) */
  department: z.string().trim().max(160).optional(),
  /** group scope */
  groupId: z.number().int().positive().optional(),
  ...fields,
});
export type AnnouncementInput = z.input<typeof announcementSchema>;

export const announcementPatchSchema = z.object(fields).partial();
export type AnnouncementPatch = z.input<typeof announcementPatchSchema>;

export const announcementsQuery = z.object({
  scope: z.enum(announcementScopes).optional().catch(undefined),
  groupId: z.coerce.number().int().positive().optional().catch(undefined),
});

export interface AnnouncementView {
  id: number;
  scope: AnnouncementScope;
  /** "Everyone", the department, or the group's name */
  audience: string;
  group: { id: number; name: string } | null;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: UserCard;
  attachments: { id: number; name: string; size: number; type: string }[];
  /** Whether I have seen it */
  read: boolean;
  /** Read receipts, for the author and admins only */
  receipts: { read: number; total: number } | null;
  can: { edit: boolean; delete: boolean };
}

export interface AnnouncementsResponse {
  items: AnnouncementView[];
  unread: number;
  /** Where I may post */
  audiences: { system: boolean; departments: string[]; groups: { id: number; name: string }[] };
}

export interface ReceiptsView {
  read: (UserCard & { readAt: string })[];
  unread: UserCard[];
}
