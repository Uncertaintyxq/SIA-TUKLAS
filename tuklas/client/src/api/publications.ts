/** Educator research API: the library, one publication, and the author's editor. */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { LibraryBrowse, LibraryParams, PublicationCard, PublicationDetail, PublicationInput, PublicationVisibility } from '../types/publications';
import { api, upload } from './client';
import { useAction } from './mutate';

export type { PublicationCard, PublicationDetail, PublicationVisibility };

export function useLibrary(p: LibraryParams) {
  const qs = new URLSearchParams({ q: p.q.trim(), year: p.year, dept: p.dept, keyword: p.keyword });
  return useQuery({
    queryKey: ['publications', 'library', p.q.trim(), p.year, p.dept, p.keyword],
    queryFn: () => api<PublicationCard[]>(`/publications?${qs}`),
    placeholderData: keepPreviousData,
  });
}

/** Departments (with how much research and how many student works each has), years and keywords. */
export const useLibraryBrowse = () =>
  useQuery({ queryKey: ['publications', 'browse'], queryFn: () => api<LibraryBrowse>('/publications/browse'), staleTime: 60_000 });

export const useMyPublications = (enabled: boolean) =>
  useQuery({ queryKey: ['publications', 'mine'], queryFn: () => api<PublicationCard[]>('/publications/mine'), enabled });

export const usePublication = (id: number) =>
  useQuery({
    queryKey: ['publication', id],
    queryFn: () => api<PublicationDetail>(`/publications/${id}`),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });

export const useCreatePublication = () => useAction((input: PublicationInput) => api<{ id: number }>('/publications', { body: input }));
export const useUpdatePublication = () =>
  useAction(({ id, ...input }: PublicationInput & { id: number }) => api(`/publications/${id}`, { method: 'PUT', body: input }));
export const useDeletePublication = () => useAction((id: number) => api(`/publications/${id}`, { method: 'DELETE' }));
export const useUploadPublicationPdf = () => useAction(({ id, file }: { id: number; file: File }) => upload(`/publications/${id}/pdf`, file));
export const useRemovePublicationPdf = () => useAction((id: number) => api(`/publications/${id}/pdf`, { method: 'DELETE' }));
