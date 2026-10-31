/**
 * Feed API hooks — the main feed, its sidebar, and research opportunities.
 * Educators post opportunities; students apply to them or withdraw.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { FeedFilter, FeedItem, FeedResponse, MyOpportunity, OpportunityCard, OpportunityInput, SidebarResponse } from '../types/feed';
import { api } from './client';
import { useAction } from './mutate';

export type { FeedFilter, FeedItem, MyOpportunity, OpportunityCard };

export interface FeedParams {
  type: FeedFilter;
  dept: string;
  q: string;
  sort: 'newest' | 'discussed';
}

export function useFeed(p: FeedParams) {
  const qs = new URLSearchParams({ type: p.type, dept: p.dept, q: p.q, sort: p.sort });
  return useQuery({ queryKey: ['feed', p], queryFn: () => api<FeedResponse>(`/feed?${qs}`), placeholderData: keepPreviousData });
}

export const useSidebar = () => useQuery({ queryKey: ['sidebar'], queryFn: () => api<SidebarResponse>('/feed/sidebar') });

export const useMyOpportunities = () => useQuery({ queryKey: ['opportunities', 'mine'], queryFn: () => api<MyOpportunity[]>('/opportunities/mine') });
export const useCreateOpportunity = () => useAction((input: OpportunityInput) => api<{ id: number }>('/opportunities', { body: input }));
export const useDeleteOpportunity = () => useAction((id: number) => api(`/opportunities/${id}`, { method: 'DELETE' }));
export const useApply = () => useAction(({ id, message }: { id: number; message: string }) => api(`/opportunities/${id}/apply`, { body: { message } }));
export const useWithdraw = () => useAction((id: number) => api(`/opportunities/${id}/apply`, { method: 'DELETE' }));
