/**
 * Reports API hooks — reporting something, and the admins' Reports queue.
 */
import { useQuery } from '@tanstack/react-query';
import type { ReportAction, ReportQueue, ReportReason, ReportTarget } from '../types/reports';
import { useAdminSchool, withSchool } from './admin';
import { api } from './client';
import { useAction } from './mutate';

export const useSendReport = () =>
  useAction((r: { type: ReportTarget; id: number; reason: ReportReason; details?: string }) => api('/reports', { body: r }));

export function useReportQueue(status: 'open' | 'closed') {
  const school = useAdminSchool();
  return useQuery({
    queryKey: ['admin', 'reports', status, school],
    queryFn: () => api<ReportQueue>(withSchool(`/admin/reports${status === 'closed' ? '?status=closed' : ''}`, school)),
  });
}

export const useResolveReport = () =>
  useAction(({ type, id, action, note }: { type: ReportTarget; id: number; action: ReportAction; note?: string }) =>
    api(`/admin/reports/${type}/${id}/resolve`, { body: { action, note: note ?? '' } }),
  );
