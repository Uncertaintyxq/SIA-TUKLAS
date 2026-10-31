/**
 * Portfolio API — React Query hooks for portfolios, profile edits and people search.
 * Covers profile fields, links, background, honors, photo and CV uploads, and the adviser list.
 */
import { useQuery } from '@tanstack/react-query';
import type { UserCard } from '../types/common';
import type { BackgroundInput, HonorInput, LinksInput, Portfolio, ProfileInput } from '../types/profile';
import { api, upload } from './client';
import { useAction } from './mutate';

export type { Portfolio, UserCard };

export function usePortfolio(username: string | undefined) {
  return useQuery({
    queryKey: ['portfolio', username],
    queryFn: () => api<Portfolio>(`/users/${encodeURIComponent(username!)}/portfolio`),
    enabled: Boolean(username),
  });
}

export const useUpdateProfile = () => useAction((input: ProfileInput) => api('/profile', { method: 'PATCH', body: input }));
export const useSaveLinks = () => useAction((input: LinksInput) => api('/profile/links', { method: 'PUT', body: input }));

export const useSaveBackground = () =>
  useAction(({ id, ...input }: BackgroundInput & { id?: number }) =>
    id ? api(`/profile/background/${id}`, { method: 'PUT', body: input }) : api('/profile/background', { body: input }),
  );
export const useDeleteBackground = () => useAction((id: number) => api(`/profile/background/${id}`, { method: 'DELETE' }));

export const useSaveHonor = () =>
  useAction(({ id, ...input }: HonorInput & { id?: number }) =>
    id ? api(`/profile/honors/${id}`, { method: 'PUT', body: input }) : api('/profile/honors', { body: input }),
  );
export const useDeleteHonor = () => useAction((id: number) => api(`/profile/honors/${id}`, { method: 'DELETE' }));

export const useUploadPhoto = () => useAction((file: File) => upload('/profile/photo', file));
export const useRemovePhoto = () => useAction(() => api('/profile/photo', { method: 'DELETE' }));
export const useUploadCv = () => useAction((file: File) => upload('/profile/cv', file));
export const useRemoveCv = () => useAction(() => api('/profile/cv', { method: 'DELETE' }));

export function usePeopleSearch(q: string, role?: UserCard['role']) {
  const term = q.trim();
  return useQuery({
    queryKey: ['people', term, role],
    queryFn: () => api<UserCard[]>(`/people/search?q=${encodeURIComponent(term)}${role ? `&role=${role}` : ''}`),
    enabled: term.length >= 2,
    staleTime: 30_000,
  });
}

export function useAdvisers() {
  return useQuery({ queryKey: ['advisers'], queryFn: () => api<UserCard[]>('/people/advisers'), staleTime: 60_000 });
}
