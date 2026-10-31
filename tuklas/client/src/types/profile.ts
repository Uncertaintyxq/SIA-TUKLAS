/** Portfolios and profile editing (/api/users, /api/profile). */
import type { UserCard } from './common';
import type { PublicationCard } from './publications';
import type { WorkCard } from './works';

export type LinkType = 'scholar' | 'orcid' | 'researchgate' | 'linkedin' | 'faculty' | 'other';
export type HonorKind = 'award' | 'grant' | 'certification';

export interface ProfileInput {
  name: string;
  titles?: string;
  program: string;
  department?: string;
  headline?: string;
  bioLong?: string;
}

export interface LinksInput {
  links: { type: LinkType; url: string; label?: string }[];
}

export interface BackgroundInput {
  degree: string;
  school: string;
  /** 4 digits */
  year: string;
}

export interface HonorInput {
  kind: HonorKind;
  title: string;
  issuer: string;
  year: string;
}

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
