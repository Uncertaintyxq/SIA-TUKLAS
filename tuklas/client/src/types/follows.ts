/** Following people, departments and keywords (FollowController). */
import type { UserCard } from './common';

export type FollowKind = 'person' | 'department' | 'tag';

/** What I follow. `target` for a person is their user id. */
export interface Follows {
  people: UserCard[];
  departments: string[];
  tags: string[];
}

export interface FollowTarget {
  kind: FollowKind;
  target: string;
}
