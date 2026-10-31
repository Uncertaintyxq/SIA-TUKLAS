/** Sign-in and the signed-in account (/api/auth). */

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
}

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
}

export interface EducatorRights {
  /** Publish research as Internal or Public */
  publish: boolean;
  /** Create research groups, manage members and roles, moderate group chat */
  moderateGroups: boolean;
  /** Post department and group announcements */
  broadcast: boolean;
}
