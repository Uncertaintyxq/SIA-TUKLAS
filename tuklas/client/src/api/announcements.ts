/** Announcements API: the feed, posting, pinning, attachments and read receipts. */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AnnouncementInput,
  AnnouncementPatch,
  AnnouncementScope,
  AnnouncementsResponse,
  AnnouncementView,
  ReceiptsView,
} from '@server/schemas/announcements';
import { api, upload } from './client';
import { useAction } from './mutate';

export type { AnnouncementScope, AnnouncementsResponse, AnnouncementView, ReceiptsView };

export function useAnnouncements(filter: { scope?: AnnouncementScope; groupId?: number } = {}) {
  const params = new URLSearchParams();
  if (filter.scope) params.set('scope', filter.scope);
  if (filter.groupId) params.set('groupId', String(filter.groupId));
  return useQuery({
    queryKey: ['announcements', filter.scope ?? 'all', filter.groupId ?? 0],
    queryFn: () => api<AnnouncementsResponse>(`/announcements?${params}`),
  });
}

export const useAnnouncementsUnread = (enabled: boolean) =>
  useQuery({ queryKey: ['announcements', 'unread'], queryFn: () => api<{ count: number }>('/announcements/unread'), enabled, refetchInterval: 60_000 });

export const useReceipts = (id: number, enabled: boolean) =>
  useQuery({ queryKey: ['announcements', 'receipts', id], queryFn: () => api<ReceiptsView>(`/announcements/${id}/receipts`), enabled });

export const useCreateAnnouncement = () => useAction((input: AnnouncementInput) => api<{ id: number }>('/announcements', { body: input }));
export const useUpdateAnnouncement = () =>
  useAction(({ id, ...patch }: AnnouncementPatch & { id: number }) => api(`/announcements/${id}`, { method: 'PATCH', body: patch }));
export const useDeleteAnnouncement = () => useAction((id: number) => api(`/announcements/${id}`, { method: 'DELETE' }));
export const useUploadAttachment = () => useAction(({ id, file }: { id: number; file: File }) => upload(`/announcements/${id}/attachments`, file, 'POST'));
export const useDeleteAttachment = () =>
  useAction(({ id, attachmentId }: { id: number; attachmentId: number }) => api(`/announcements/${id}/attachments/${attachmentId}`, { method: 'DELETE' }));

/** The read receipt. Refreshes only the announcement counts, not every view. */
export function useMarkAnnouncementRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/announcements/${id}/read`, { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['announcements'] }),
  });
}
