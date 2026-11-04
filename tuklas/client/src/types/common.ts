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
  departmentId: number | null;
  /** Their school (docs/decisions/0002); null only on a site without schools */
  institution: InstitutionCard | null;
  photoUrl: string | null;
}

/** One school's department (each school keeps its own list). */
export interface DepartmentCard {
  id: number;
  name: string;
  institution: InstitutionCard | null;
}

/** A school on this Tuklas site, as person cards show it. */
export interface InstitutionCard {
  id: number;
  name: string;
  /** May be empty; show the name then */
  shortName: string;
}
