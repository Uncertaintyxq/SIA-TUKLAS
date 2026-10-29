/**
 * Works API — React Query hooks for research works, from drafting to review.
 * Covers the author's works, the adviser review queue, stages, PDFs, reactions and discussion.
 */
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type {
  CreateWorkInput,
  DecisionInput,
  MyWork,
  ReactionKind,
  SimilarWork,
  StageInput,
  WorkCard,
  WorkDetail,
  WorkInput,
} from '@server/schemas/works';
import { api, upload } from './client';
import { useAction } from './mutate';

export type { MyWork, SimilarWork, WorkCard, WorkDetail };

export const useMyWorks = () => useQuery({ queryKey: ['works', 'mine'], queryFn: () => api<MyWork[]>('/works/mine') });
export const useReviewQueue = () => useQuery({ queryKey: ['works', 'review'], queryFn: () => api<MyWork[]>('/works/review-queue') });

export function useWork(id: number) {
  return useQuery({ queryKey: ['work', id], queryFn: () => api<WorkDetail>(`/works/${id}`), enabled: Number.isInteger(id) && id > 0, retry: false });
}

/** Topic overlap check, run as the author types. */
export function useSimilar(title: string, keywords: string, exclude?: number) {
  const ready = `${title} ${keywords}`.trim().length >= 4;
  return useQuery({
    queryKey: ['similar', title, keywords, exclude],
    queryFn: () =>
      api<SimilarWork[]>(`/works/similar?title=${encodeURIComponent(title)}&keywords=${encodeURIComponent(keywords)}${exclude ? `&exclude=${exclude}` : ''}`),
    enabled: ready,
    placeholderData: keepPreviousData,
    staleTime: 60_000,
  });
}

export const useCreateWork = () => useAction((input: CreateWorkInput) => api<{ id: number }>('/works', { body: input }));
export const useUpdateWork = () => useAction(({ id, ...input }: WorkInput & { id: number }) => api(`/works/${id}`, { method: 'PUT', body: input }));
export const useDeleteWork = () => useAction((id: number) => api(`/works/${id}`, { method: 'DELETE' }));
export const useUploadWorkPdf = () => useAction(({ id, file }: { id: number; file: File }) => upload(`/works/${id}/pdf`, file));
export const useRemoveWorkPdf = () => useAction((id: number) => api(`/works/${id}/pdf`, { method: 'DELETE' }));
export const useSubmitWork = () => useAction(({ id, note }: { id: number; note?: string }) => api(`/works/${id}/submit`, { body: { note: note ?? '' } }));
export const useDecision = () => useAction(({ id, ...input }: DecisionInput & { id: number }) => api(`/works/${id}/decision`, { body: input }));
export const useReviewComment = () => useAction(({ id, text }: { id: number; text: string }) => api(`/works/${id}/comments`, { body: { text } }));

export const usePatchItem = () =>
  useAction(({ id, itemId, ...patch }: { id: number; itemId: number; done?: boolean; confirmed?: boolean }) =>
    api(`/works/${id}/items/${itemId}`, { method: 'PATCH', body: patch }),
  );

export const useSaveStage = () =>
  useAction(({ id, stageId, ...input }: StageInput & { id: number; stageId?: number }) =>
    stageId ? api(`/works/${id}/stages/${stageId}`, { method: 'PUT', body: input }) : api(`/works/${id}/stages`, { body: input }),
  );
export const useDeleteStage = () => useAction(({ id, stageId }: { id: number; stageId: number }) => api(`/works/${id}/stages/${stageId}`, { method: 'DELETE' }));

export const useReact = () =>
  useAction(({ id, kind }: { id: number; kind: ReactionKind | null }) =>
    kind ? api(`/works/${id}/reaction`, { method: 'PUT', body: { kind } }) : api(`/works/${id}/reaction`, { method: 'DELETE' }),
  );
export const useSave = () => useAction(({ id, saved }: { id: number; saved: boolean }) => api(`/works/${id}/save`, { method: saved ? 'PUT' : 'DELETE' }));
export const useDiscuss = () => useAction(({ id, text }: { id: number; text: string }) => api(`/works/${id}/discussion`, { body: { text } }));
export const useDeleteDiscussion = () =>
  useAction(({ id, commentId }: { id: number; commentId: number }) => api(`/works/${id}/discussion/${commentId}`, { method: 'DELETE' }));
