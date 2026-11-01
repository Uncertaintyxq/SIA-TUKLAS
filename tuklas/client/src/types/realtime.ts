/**
 * Live updates on each person's private channel (users.{id}, event "tuklas"). They name what
 * changed, never the content: the client refetches through the API, which applies every access
 * rule. Who is online comes from the "online" presence channel instead.
 */
export type RealtimeEvent =
  | { type: 'message'; conversationId: number; messageId: number; parentId: number | null }
  | { type: 'message_deleted'; conversationId: number; messageId: number }
  | { type: 'notification'; kind: string };
