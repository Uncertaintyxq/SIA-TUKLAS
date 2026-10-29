/**
 * Chat helpers — message serialization and real-time fan-out, shared by the chat routes.
 */
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { isOnline, pushTo } from '../realtime.js';
import type { ChatPerson, MessageView } from '../schemas/chat.js';
import { toUserCard, userCardSelect } from './serialize.js';

export const messageInclude = {
  sender: { select: userCardSelect },
  _count: { select: { replies: { where: { deletedAt: null } } } },
} satisfies Prisma.MessageInclude;

export type MessageRow = Prisma.MessageGetPayload<{ include: typeof messageInclude }>;

export function toMessageView(m: MessageRow, canDelete: boolean): MessageView {
  const deleted = Boolean(m.deletedAt);
  const stored = Boolean(m.file || m.groupFileId);
  return {
    id: m.id,
    conversationId: m.conversationId,
    parentId: m.parentId,
    sender: toUserCard(m.sender),
    text: deleted ? '' : m.text,
    deleted,
    file:
      !deleted && stored && m.fileName
        ? { name: m.fileName, size: m.fileSize ?? 0, type: m.fileType ?? 'application/octet-stream', url: `/api/chat/messages/${m.id}/file` }
        : null,
    removedFile: !deleted && !stored && m.fileName ? m.fileName : null,
    replyCount: m._count.replies,
    createdAt: m.createdAt.toISOString(),
    canDelete: !deleted && canDelete,
  };
}

export const chatPersonSelect = { ...userCardSelect, lastSeenAt: true } satisfies Prisma.UserSelect;

export function toChatPerson(u: Prisma.UserGetPayload<{ select: typeof chatPersonSelect }>): ChatPerson {
  const online = isOnline(u.id);
  return { ...toUserCard(u), online, lastSeenAt: online ? null : (u.lastSeenAt?.toISOString() ?? null) };
}

/** Tells every member's open tabs that a conversation changed; they refetch through the API. */
export async function announceMessage(conversationId: number, messageId: number, parentId: number | null, deleted = false) {
  const members = await prisma.conversationMember.findMany({ where: { conversationId }, select: { userId: true } });
  const ids = members.map((m) => m.userId);
  pushTo(ids, deleted ? { type: 'message_deleted', conversationId, messageId } : { type: 'message', conversationId, messageId, parentId });
}

/** Unread messages per conversation for one person: anything newer than their read marker, not sent by them. */
export async function unreadByConversation(userId: number) {
  const rows = await prisma.$queryRaw<{ conversationId: number; n: bigint }[]>`
    SELECT m.conversationId, COUNT(*) AS n
    FROM messages m
    JOIN conversation_members cm ON cm.conversationId = m.conversationId AND cm.userId = ${userId}
    WHERE m.createdAt > cm.lastReadAt AND m.senderId <> ${userId} AND m.deletedAt IS NULL
    GROUP BY m.conversationId`;
  return new Map(rows.map((r) => [Number(r.conversationId), Number(r.n)]));
}
