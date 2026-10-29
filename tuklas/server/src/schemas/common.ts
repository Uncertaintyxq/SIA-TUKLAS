/**
 * Common schemas — shared validators for id params and years.
 * Exports UserCard, the person shape every other schema reuses.
 */
import { z } from 'zod';
import type { Role } from './auth.js';

export const idParam = z.coerce.number().int().positive();

export const yearField = z.string().trim().regex(/^\d{4}$/, 'Enter a 4-digit year');

/** A person as every other screen shows them: name, role badge, photo and where they belong. */
export interface UserCard {
  id: number;
  name: string;
  username: string;
  role: Role;
  /** Educators only count as advisers once an admin verifies them. */
  verified: boolean;
  program: string;
  department: string;
  photoUrl: string | null;
}
