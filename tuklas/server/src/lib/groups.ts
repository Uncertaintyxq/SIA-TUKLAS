/**
 * Group helpers — group plumbing shared by the groups, chat and announcement routes.
 */
import { prisma } from '../db.js';

// ---------- Activity log ----------

/**
 * Actions: group_created, member_added, member_removed, member_left, role_changed, file_shared, file_deleted,
 * deadline_added, channel_created, channel_deleted, announcement_posted.
 */
export async function logActivity(groupId: number, actorId: number, action: string, detail: string) {
  await prisma.groupActivity.create({ data: { groupId, actorId, action, detail: detail.slice(0, 300) } });
}

// ---------- Channels ----------

/** Creates a channel with everyone currently in the group as a member. */
export function createChannel(groupId: number, name: string, participantIds: number[]) {
  return prisma.conversation.create({
    data: { kind: 'channel', groupId, name, members: { create: [...new Set(participantIds)].map((userId) => ({ userId })) } },
  });
}

/** Every group has #general. Groups made before chat existed get it the first time they're opened. */
export async function ensureGeneralChannel(groupId: number, participantIds: number[]) {
  if ((await prisma.conversation.count({ where: { groupId } })) === 0) await createChannel(groupId, 'general', participantIds);
}

/** Keeps channel membership in step with group membership. */
export async function joinGroupChannels(groupId: number, userId: number) {
  const channels = await prisma.conversation.findMany({ where: { groupId }, select: { id: true } });
  await prisma.conversationMember.createMany({ data: channels.map((c) => ({ conversationId: c.id, userId })), skipDuplicates: true });
}

export async function leaveGroupChannels(groupId: number, userId: number) {
  await prisma.conversationMember.deleteMany({ where: { userId, conversation: { groupId } } });
}
