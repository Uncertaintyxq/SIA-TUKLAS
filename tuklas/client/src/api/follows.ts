/**
 * Follows API hooks — what I follow, and following or unfollowing a person, department or keyword.
 */
import { useQuery } from '@tanstack/react-query';
import type { FollowTarget, Follows } from '../types/follows';
import { api } from './client';
import { useAction } from './mutate';

export type { FollowTarget, Follows };

export const useFollows = (enabled = true) => useQuery({ queryKey: ['follows'], queryFn: () => api<Follows>('/follows'), enabled });
export const useFollow = () => useAction((t: FollowTarget) => api('/follows', { body: t }));
export const useUnfollow = () => useAction((t: FollowTarget) => api('/follows', { method: 'DELETE', body: t }));

/** Whether I follow this already (keywords match ignoring case, like the server). */
export function isFollowing(f: Follows | undefined, { kind, target }: FollowTarget): boolean {
  if (!f) return false;
  if (kind === 'person') return f.people.some((u) => String(u.id) === target);
  if (kind === 'department') return f.departments.includes(target);
  return f.tags.some((t) => t.toLowerCase() === target.toLowerCase());
}
