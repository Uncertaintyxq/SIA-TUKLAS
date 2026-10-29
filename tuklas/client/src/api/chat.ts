/** Chat API: conversations, messages, threads, files and search. New messages arrive through lib/realtime. */
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ConversationPage, ConversationSummary, MessageInput, MessageView, SearchHit, ThreadView } from '@server/schemas/chat';
import { api, upload } from './client';

export type { ConversationPage, ConversationSummary, MessageView, SearchHit, ThreadView };

export const useConversations = (enabled = true) =>
  useQuery({ queryKey: ['chat', 'conversations'], queryFn: () => api<ConversationSummary[]>('/chat/conversations'), enabled });

/** Unread messages for the nav badge. Realtime events refresh it; the interval is a fallback. */
export const useChatUnread = (enabled: boolean) =>
  useQuery({ queryKey: ['chat', 'unread'], queryFn: () => api<{ messages: number }>('/chat/unread'), enabled, refetchInterval: 60_000 });

/** A conversation's messages, newest page first; fetchNextPage loads older ones. */
export function useConversation(id: number) {
  return useInfiniteQuery({
    queryKey: ['chat', 'conversation', id],
    queryFn: ({ pageParam }) => api<ConversationPage>(`/chat/conversations/${id}${pageParam ? `?before=${pageParam}` : ''}`),
    initialPageParam: 0,
    getNextPageParam: (last) => (last.hasMore ? last.messages[0]?.id : undefined),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });
}

export const useThread = (messageId: number | null) =>
  useQuery({
    queryKey: ['chat', 'thread', messageId],
    queryFn: () => api<ThreadView>(`/chat/messages/${messageId}/replies`),
    enabled: messageId !== null,
  });

export function useChatSearch(q: string) {
  const term = q.trim();
  return useQuery({
    queryKey: ['chat', 'search', term],
    queryFn: () => api<SearchHit[]>(`/chat/search?q=${encodeURIComponent(term)}`),
    enabled: term.length >= 2,
    placeholderData: keepPreviousData,
  });
}

/** Chat mutations refresh only chat (and group) queries; the realtime push covers everyone else. */
function useChatAction<TVars, TResult = void>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat'] });
      qc.invalidateQueries({ queryKey: ['group'] });
    },
  });
}

export const useSendMessage = () =>
  useChatAction(({ conversationId, ...input }: MessageInput & { conversationId: number }) =>
    api<MessageView>(`/chat/conversations/${conversationId}/messages`, { body: input }),
  );

export const useSendFile = () =>
  useChatAction(({ conversationId, file, text }: { conversationId: number; file: File; text?: string }) =>
    upload<MessageView>(`/chat/conversations/${conversationId}/files${text ? `?text=${encodeURIComponent(text)}` : ''}`, file, 'POST'),
  );

export const useDeleteMessage = () => useChatAction((id: number) => api(`/chat/messages/${id}`, { method: 'DELETE' }));

/** Moves my read marker; only the lists and badges need refreshing, not the open conversation. */
export function useMarkConversationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api(`/chat/conversations/${id}/read`, { method: 'POST' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'conversations'] });
      qc.invalidateQueries({ queryKey: ['chat', 'unread'] });
      qc.invalidateQueries({ queryKey: ['group'] });
    },
  });
}

export const useStartDirect = () => useChatAction((userId: number) => api<{ id: number }>('/chat/direct', { body: { userId } }));
