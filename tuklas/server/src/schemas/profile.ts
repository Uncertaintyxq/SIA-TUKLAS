/**
 * Profile schemas — validate profile details, academic links, background entries and honors.
 * Exports the Portfolio type and its view types for the client profile page.
 */
import { z } from 'zod';
import { yearField, type UserCard } from './common.js';
import type { PublicationCard } from './publications.js';
import type { WorkCard } from './works.js';

export const linkTypes = ['scholar', 'orcid', 'researchgate', 'linkedin', 'faculty', 'other'] as const;
export type LinkType = (typeof linkTypes)[number];
export const honorKinds = ['award', 'grant', 'certification'] as const;
export type HonorKind = (typeof honorKinds)[number];

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  titles: z.string().trim().max(120).default(''),
  program: z.string().trim().min(2, 'Enter your program or position').max(160),
  department: z.string().trim().max(160).default(''),
  headline: z.string().trim().max(160).default(''),
  bioLong: z.string().trim().max(5000).default(''),
});
export type ProfileInput = z.input<typeof profileSchema>;

const httpUrl = z
  .string()
  .trim()
  .max(300)
  .url('Enter a full link, starting with https://')
  .refine((u) => /^https?:\/\//i.test(u), 'Links must start with https:// or http://');

export const linksSchema = z.object({
  links: z
    .array(z.object({ type: z.enum(linkTypes), url: httpUrl, label: z.string().trim().max(80).default('') }))
    .max(12, 'Add at most 12 links'),
});
export type LinksInput = z.input<typeof linksSchema>;

export const backgroundSchema = z.object({
  degree: z.string().trim().min(2, 'Enter the degree or diploma').max(160),
  school: z.string().trim().min(2, 'Enter the school').max(160),
  year: yearField,
});
export type BackgroundInput = z.input<typeof backgroundSchema>;

export const honorSchema = z.object({
  kind: z.enum(honorKinds),
  title: z.string().trim().min(2, 'Enter the title of the honor').max(160),
  issuer: z.string().trim().min(2, 'Enter who gave it').max(160),
  year: yearField,
});
export type HonorInput = z.input<typeof honorSchema>;

export interface AcademicLinkView {
  id: number;
  type: LinkType;
  url: string;
  label: string;
}

export interface BackgroundView {
  id: number;
  degree: string;
  school: string;
  year: string;
}

export interface HonorView {
  id: number;
  kind: HonorKind;
  title: string;
  issuer: string;
  year: string;
  verified: boolean;
}

export interface Portfolio {
  user: UserCard & { headline: string };
  titles: string;
  bioLong: string;
  cv: { url: string; name: string } | null;
  links: AcademicLinkView[];
  background: BackgroundView[];
  /** The public sees verified honors only; the owner and admins also see pending ones. */
  honors: HonorView[];
  /** Approved works the person authored or co-authored */
  works: WorkCard[];
  /** Approved works this educator advised */
  mentored: WorkCard[];
  /** Research this educator published: Public for everyone, Internal too for signed-in viewers */
  publications: PublicationCard[];
  stats: { published: number; mentored: number; publications: number; verifiedHonors: number; degrees: number };
  isOwner: boolean;
}
