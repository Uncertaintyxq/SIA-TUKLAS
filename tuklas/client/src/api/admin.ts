/**
 * Admin API hooks — queries and actions for the admin console under /api/admin.
 * Covers stats, the moderation queue, users, educators, and notifications.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { AdminEducators, AdminPosts, AdminQueue, AdminStats, AdminUser, EducatorOverview, UserPatch } from '../types/admin';
import type { Role } from '../types/auth';
import type { NotificationsResponse } from '../types/notifications';
import { api } from './client';
import { useAction } from './mutate';

export type { AdminUser, EducatorOverview };

export const useAdminStats = () => useQuery({ queryKey: ['admin', 'stats'], queryFn: () => api<AdminStats>('/admin/stats') });
export const useAdminQueue = () => useQuery({ queryKey: ['admin', 'queue'], queryFn: () => api<AdminQueue>('/admin/queue') });
export const useAdminPosts = (enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'posts'], queryFn: () => api<AdminPosts>('/admin/posts'), enabled });

export function useAdminUsers(q: string, role: Role | '', enabled: boolean) {
  return useQuery({
    queryKey: ['admin', 'users', q, role],
    queryFn: () => api<AdminUser[]>(`/admin/users?q=${encodeURIComponent(q)}${role ? `&role=${role}` : ''}`),
    enabled,
    placeholderData: keepPreviousData,
  });
}

export const useAdminEducators = (enabled: boolean) =>
  useQuery({ queryKey: ['admin', 'educators'], queryFn: () => api<AdminEducators>('/admin/educators'), enabled });

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
