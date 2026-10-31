/**
 * Live updates. They name what changed, never the content: the client refetches through the API,
 * which applies every access rule.
 */
export type RealtimeEvent =
  | { type: 'message'; conversationId: number; messageId: number; parentId: number | null }
  | { type: 'message_deleted'; conversationId: number; messageId: number }
  | { type: 'notification'; kind: string }
  | { type: 'presence'; userId: number; online: boolean; lastSeenAt: string | null };
