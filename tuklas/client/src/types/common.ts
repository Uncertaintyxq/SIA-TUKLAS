/**
 * Shapes the API returns, shared by the API hooks and pages. They mirror the Laravel API
 * Resources (tuklas/app/Http/Resources): change both together.
 */
import type { Role } from './auth';

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
