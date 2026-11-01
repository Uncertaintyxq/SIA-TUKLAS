/** Direct messages and group channels (/api/chat). */
import type { UserCard } from './common';

export interface MessageInput {
  /** 1–4,000 characters */
  text: string;
  /** Reply in the thread under this message */
  parentId?: number;
}

export interface ChannelInput {
  /** Lowercased, spaces become dashes; letters, numbers and dashes */
  name: string;
}

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
  /** Set when the sender changed the text */
  editedAt: string | null;
  /** One entry per emoji someone used, with who used it */
  reactions: MessageReaction[];
  canDelete: boolean;
  /** Only the sender edits */
  canEdit: boolean;
}

export interface MessageReaction {
  emoji: string;
  count: number;
  mine: boolean;
  people: string[];
}

export interface ConversationPage {
  conversation: ConversationSummary;
  messages: MessageView[];
  /** Older messages exist before the first one */
  hasMore: boolean;
  /** How far everyone else has read, for "Seen by" under my latest message */
  readers: { id: number; name: string; readAt: string }[];
}

export interface ThreadView {
  parent: MessageView;
  replies: MessageView[];
}
