/** Following people, departments and keywords (FollowController). */
import type { DepartmentCard, UserCard } from './common';

export type FollowKind = 'person' | 'department' | 'tag';

/** What I follow. `target` for a person or department is its id. */
export interface Follows {
  people: UserCard[];
  departments: DepartmentCard[];
  tags: string[];
}

export interface FollowTarget {
  kind: FollowKind;
  target: string;
}
