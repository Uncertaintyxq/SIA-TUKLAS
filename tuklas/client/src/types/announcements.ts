/** Announcements and read receipts (/api/announcements). */
import type { DepartmentCard, InstitutionCard, UserCard } from './common';

/** system: every school (super-admins). school: one school (its admins). */
export type AnnouncementScope = 'system' | 'school' | 'department' | 'group';

export interface AnnouncementInput {
  scope: AnnouncementScope;
  /** school scope: which school (super-admins pick; a school's admins post to their own) */
  institutionId?: number;
  /** department scope: which department (admins pick; educators always post to their own) */
  departmentId?: number;
  /** group scope */
  groupId?: number;
  title: string;
  /** Light markup: **bold**, _italic_, "## " headings, "- " and "1. " lists, [text](https://…) links */
  body: string;
  pinned?: boolean;
}

export interface AnnouncementPatch {
  title?: string;
  body?: string;
  pinned?: boolean;
}

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
  audiences: { system: boolean; schools: InstitutionCard[]; departments: DepartmentCard[]; groups: { id: number; name: string }[] };
}

export interface ReceiptsView {
  read: (UserCard & { readAt: string })[];
  unread: UserCard[];
}
