/**
 * Rights — the educator rights (publish, moderate groups, broadcast) and how to check them.
 * Other policies call hasRight(); rightsOf() gives the client the full set for one user.
 */
import type { User } from '@prisma/client';

/** Educator rights an admin can grant or revoke from the admin dashboard. */
export type Right = 'publish' | 'moderateGroups' | 'broadcast';

/**
 * Admins hold every right. An educator holds a right once an admin has verified them,
 * unless an admin has revoked it. Students hold none.
 */
export function hasRight(u: Pick<User, 'role' | 'verified' | 'canPublish' | 'canModerateGroups' | 'canBroadcast'> | undefined, right: Right) {
  if (!u) return false;
  if (u.role === 'admin') return true;
  if (u.role !== 'educator' || !u.verified) return false;
  if (right === 'publish') return u.canPublish;
  if (right === 'moderateGroups') return u.canModerateGroups;
  return u.canBroadcast;
}

/** All three rights for one user, as flags. */
export const rightsOf =(u: Parameters<typeof hasRight>[0]) => ({
  publish: hasRight(u, 'publish'),
  moderateGroups: hasRight(u, 'moderateGroups'),
  broadcast: hasRight(u, 'broadcast'),
});
