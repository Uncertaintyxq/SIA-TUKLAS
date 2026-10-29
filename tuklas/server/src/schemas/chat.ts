/**
 * Chat schemas — validate messages, direct chats, channel names, search and paging.
 * Exports conversation, message, thread and search-hit types for the client.
 */
import { z } from 'zod';
import type { UserCard } from './common.js';

export const messageSchema = z.object({
  text: z.string().trim().min(1, 'Write a message first').max(4000, 'Keep a message under 4,000 characters'),
  /** Reply in the thread under this message */
  parentId: z.number().int().positive().optional(),
});
export type MessageInput = z.input<typeof messageSchema>;

export const directSchema = z.object({ userId: z.number().int().positive() });

export const channelSchema = z.object({
  name: z
    .string()
    .trim()
    .toLowerCase()
    .transform((s) => s.replace(/\s+/g, '-'))
    .pipe(z.string().min(2, 'Name the channel (2+ characters)').max(40).regex(/^[a-z0-9][a-z0-9-]*$/, 'Use letters, numbers and dashes')),
});
export type ChannelInput = z.input<typeof channelSchema>;

export const searchQuery = z.object({ q: z.string().trim().min(2, 'Type at least 2 characters').max(80) });
export const pageQuery = z.object({ before: z.coerce.number().int().positive().optional().catch(undefined) });

/** Someone in a chat, with presence. */
export interface ChatPerson extends UserCard {
  online: boolean;
  lastSeenAt: string | null;
}

export interface ConversationSummary {
  id: number;
  kind: 'direct' | 'channel';
  /** Channel name, or the other person's name in a direct chat */
  name: string;
  group: { id: number; name: string } | null;
  other: ChatPerson | null;
  lastMessage: { text: string; senderName: string; createdAt: string; hasFile: boolean } | null;
  lastMessageAt: string;
  unread: number;
}

export interface MessageView {
  id: number;
  conversationId: number;
  parentId: number | null;
  sender: UserCard;
  text: string;
  deleted: boolean;
  file: { name: string; size: number; type: string; url: string } | null;
  /** A file that was shared here and has since been deleted */
  removedFile: string | null;
  replyCount: number;
  createdAt: string;
  canDelete: boolean;
}

export interface ConversationPage {
  conversation: ConversationSummary;
  messages: MessageView[];
  /** Older messages exist before the first one */
  hasMore: boolean;
}

export interface ThreadView {
  parent: MessageView;
  replies: MessageView[];
}

export interface SearchHit {
  message: MessageView;
  conversation: Pick<ConversationSummary, 'id' | 'kind' | 'name' | 'group'>;
}
