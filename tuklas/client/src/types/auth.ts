/** Sign-in and the signed-in account (/api/auth). */
import type { InstitutionCard } from './common';

export type Role = 'student' | 'educator' | 'admin';

export interface LoginInput {
  email: string;
  password: string;
}

/** Admin accounts are issued by the Office of Research, never self-created. */
export interface SignupInput {
  name: string;
  email: string;
  password: string;
  role: 'student' | 'educator';
  program: string;
  /** The school picked by hand: needed without a school email address, and then its admins confirm the account */
  institutionId?: number | null;
  /** Consent to the privacy notice (Data Privacy Act). The server refuses signup without it. */
  privacy: boolean;
}

/** A login either signs in, or, when the account has 2FA, asks for the code first. */
export type LoginResult = { user: PublicUser; twoFactor: false } | { user: null; twoFactor: true };

/** The user as the API returns it — never includes the password hash. */
export interface PublicUser {
  id: number;
  name: string;
  username: string;
  email: string;
  role: Role;
  /** False for an educator an admin hasn't verified yet. */
  verified: boolean;
  program: string;
  headline: string;
  /** What this person may do beyond their role's basics */
  rights: EducatorRights;
  emailVerified: boolean;
  /** The email must be confirmed before anything else works (false in demo mode). */
  emailVerificationRequired: boolean;
  twoFactorEnabled: boolean;
  /** Admins and educators must turn on 2FA before anything else works (false in demo mode). */
  twoFactorRequired: boolean;
  /** Has accepted the current version of the privacy notice. */
  privacyAccepted: boolean;
  institution: InstitutionCard | null;
  /** Signed up without the school's email domain: waits for the school's admins (false in demo mode). */
  schoolConfirmationRequired: boolean;
  /** Manages the schools on the site (admins only) */
  superAdmin: boolean;
}

export interface EducatorRights {
  /** Publish research as School only or Public */
  publish: boolean;
  /** Create research groups, manage members and roles, moderate group chat */
  moderateGroups: boolean;
  /** Post department and group announcements */
  broadcast: boolean;
}
