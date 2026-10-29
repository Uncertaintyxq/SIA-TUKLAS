/**
 * Auth schemas — validate login and signup forms.
 * Exports Role, PublicUser and EducatorRights for the client.
 */
import { z } from 'zod';

export const roles = ['student', 'educator', 'admin'] as const;
export type Role = (typeof roles)[number];

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

// Admin accounts are issued by the Office of Research, never self-created.
export const signupSchema = z.object({
  name: z.string().trim().min(2, 'Enter your full name').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid school email').max(191),
  password: z.string().min(8, 'Use at least 8 characters').max(72),
  role: z.enum(['student', 'educator']),
  program: z.string().trim().min(2, 'Enter your program or department').max(160),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

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
  /** What this person may do beyond their role's basics (see server/src/policies/rights.ts) */
  rights: EducatorRights;
}

export interface EducatorRights {
  /** Publish research as Internal or Public */
  publish: boolean;
  /** Create research groups, manage members and roles, moderate group chat */
  moderateGroups: boolean;
  /** Post department and group announcements */
  broadcast: boolean;
}
