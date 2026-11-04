/**
 * Admin API hooks — queries and actions for the admin console under /api/admin.
 * Covers stats, the moderation queue, users, educators, and notifications.
 */
import { useSearchParams } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AdminEducators, AdminPosts, AdminQueue, AdminStats, AdminUser, EducatorOverview, UserPatch } from '../types/admin';
import type { Role } from '../types/auth';
import type { NotificationsResponse } from '../types/notifications';
import { api } from './client';
import { useAction } from './mutate';

export type { AdminUser, EducatorOverview };

/**
 * The school a super-admin picked on the admin page (?school=), or '' for every school. A school's
 * admins always see their own school: the server decides (docs/decisions/0002).
 */
export function useAdminSchool() {
  const [params] = useSearchParams();
  return params.get('school') ?? '';
}

/** Adds the picked school to an admin API path. */
export const withSchool = (path: string, school: string) => (school ? `${path}${path.includes('?') ? '&' : '?'}institution=${school}` : path);

export function useAdminStats() {
  const school = useAdminSchool();
  return useQuery({ queryKey: ['admin', 'stats', school], queryFn: () => api<AdminStats>(withSchool('/admin/stats', school)) });
}
export function useAdminQueue() {
  const school = useAdminSchool();
  return useQuery({ queryKey: ['admin', 'queue', school], queryFn: () => api<AdminQueue>(withSchool('/admin/queue', school)) });
}
export function useAdminPosts(enabled: boolean) {
  const school = useAdminSchool();
  return useQuery({ queryKey: ['admin', 'posts', school], queryFn: () => api<AdminPosts>(withSchool('/admin/posts', school)), enabled });
}

export function useAdminUsers(q: string, role: Role | '', enabled: boolean) {
  const school = useAdminSchool();
  return useQuery({
    queryKey: ['admin', 'users', q, role, school],
    queryFn: () => api<AdminUser[]>(withSchool(`/admin/users?q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`, school)),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export function useAdminEducators(enabled: boolean) {
  const school = useAdminSchool();
  return useQuery({ queryKey: ['admin', 'educators', school], queryFn: () => api<AdminEducators>(withSchool('/admin/educators', school)), enabled });
}

/** Role, verification and educator rights. */
export const usePatchUser = () => useAction(({ id, ...patch }: UserPatch & { id: number }) => api(`/admin/users/${id}`, { method: 'PATCH', body: patch }));
export const useModerateEvent = () =>
  useAction(({ id, approve }: { id: number; approve: boolean }) => api(`/admin/events/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' }));
export const useModerateAd = () =>
  useAction(({ id, approve }: { id: number; approve: boolean }) => api(`/admin/ads/${id}/${approve ? 'approve' : 'reject'}`, { method: 'POST' }));
export const useModerateHonor = () =>
  useAction(({ id, verify }: { id: number; verify: boolean }) => api(`/admin/honors/${id}/${verify ? 'verify' : 'decline'}`, { method: 'POST' }));
export const useRemoveWork = () =>
  useAction(({ id, remove, reason }: { id: number; remove: boolean; reason?: string }) =>
    api(`/admin/works/${id}/${remove ? 'remove' : 'restore'}`, { body: { reason: reason ?? '' } }),
  );

export const useNotifications = () =>
  useQuery({ queryKey: ['notifications'], queryFn: () => api<NotificationsResponse>('/notifications'), refetchInterval: 60_000 });
export const useMarkRead = () => useAction((ids?: number[]) => api('/notifications/read', { body: ids ? { ids } : {} }));
