/**
 * Live updates on each person's private channel (users.{id}, event "tuklas"). They name what
 * changed, never the content: the client refetches through the API, which applies every access
 * rule. Who is online comes from the "online" presence channel instead.
 */
export type RealtimeEvent =
  | { type: 'message'; conversationId: number; messageId: number; parentId: number | null }
  | { type: 'message_deleted'; conversationId: number; messageId: number }
  /** Edited or reacted to: refetch, but it isn't new */
  | { type: 'message_changed'; conversationId: number; messageId: number }
  /** Someone else read the conversation ("Seen by") */
  | { type: 'conversation_read'; conversationId: number }
  | { type: 'notification'; kind: string };
