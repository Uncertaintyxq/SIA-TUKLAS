/**
 * Groups routes — create and run research groups at /api/groups.
 * Covers groups, members and roles, channels, shared files and deadlines.
 */
import { Router, type Response } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { unreadByConversation } from '../lib/chat.js';
import { deleteUpload, rawBody, readUpload, saveUpload, sendUpload, storedType } from '../lib/files.js';
import { createChannel, ensureGeneralChannel, joinGroupChannels, leaveGroupChannels, logActivity } from '../lib/groups.js';
import { notify } from '../lib/notify.js';
import { toUserCard, userCardSelect } from '../lib/serialize.js';
import {
  canAnnounceToGroup,
  canManageGroup,
  canModerateGroup,
  canOpenGroup,
  canOrganizeGroup,
  participantIds,
  seatOf,
} from '../policies/groups.js';
import { hasRight } from '../policies/rights.js';
import { channelSchema } from '../schemas/chat.js';
import { idParam } from '../schemas/common.js';
import { deadlineSchema, groupSchema, memberRoleSchema, memberSchema, type GroupDetail, type GroupSummary } from '../schemas/groups.js';

/**
 * Research groups: an adviser, students (one may lead), educator mentors, shared files, deadlines,
 * text channels and an activity log. /api/groups/…  The rules live in src/policies/groups.ts.
 */
export const groupsRouter = Router();
groupsRouter.use(requireAuth);

const notFound = (res: Response) => res.status(404).json({ error: 'That group doesn’t exist or you’re not in it.' });
const forbidden = (res: Response, error: string) => res.status(403).json({ error });

const roleName = { leader: 'group leader', member: 'member', mentor: 'mentor' } as const;

const summaryInclude = {
  adviser: { select: userCardSelect },
  members: { select: { userId: true, role: true } },
  deadlines: { orderBy: { dueAt: 'asc' as const } },
  _count: { select: { members: true, files: true } },
};

/** Loads a group the user may open (adviser, member, or admin), with members and their roles. */
async function loadGroup(id: number, me: User) {
  const g = await prisma.researchGroup.findUnique({ where: { id }, include: { members: { select: { userId: true, role: true } } } });
  return g && canOpenGroup(g, me) ? g : null;
}

const nextDeadline = (deadlines: { title: string; dueAt: Date }[]) => {
  const next = deadlines.find((d) => d.dueAt.getTime() >= Date.now());
  return next ? { title: next.title, dueAt: next.dueAt.toISOString() } : null;
};

// ---------- Groups ----------

groupsRouter.get('/', async (req, res) => {
  const me = req.user!;
  const groups = await prisma.researchGroup.findMany({
    where: me.role === 'admin' ? {} : { OR: [{ adviserId: me.id }, { members: { some: { userId: me.id } } }] },
    include: summaryInclude,
    orderBy: { createdAt: 'desc' },
  });
  const body: GroupSummary[] = groups.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    adviser: toUserCard(g.adviser),
    memberCount: g._count.members,
    fileCount: g._count.files,
    nextDeadline: nextDeadline(g.deadlines),
    isAdviser: g.adviserId === me.id,
    mySeat: seatOf(g, me),
  }));
  res.json(body);
});

/** Verified educators who hold the group moderation right start groups; they become the adviser. */
groupsRouter.post('/', requireRole('educator'), async (req, res) => {
  const me = req.user!;
  if (!hasRight(me, 'moderateGroups')) {
    forbidden(res, me.verified ? 'An admin has turned off your group moderation right.' : 'An admin needs to verify your educator account first.');
    return;
  }
  const input = groupSchema.parse(req.body);
  const g = await prisma.researchGroup.create({ data: { ...input, adviserId: me.id } });
  await createChannel(g.id, 'general', [me.id]);
  await logActivity(g.id, me.id, 'group_created', `${me.name} started the group.`);
  res.status(201).json({ id: g.id });
});

groupsRouter.get('/:id', async (req, res) => {
  const me = req.user!;
  const id = idParam.parse(req.params.id);
  const access = await loadGroup(id, me);
  if (!access) {
    notFound(res);
    return;
  }
  await ensureGeneralChannel(id, participantIds(access));
  const [g, unread] = await Promise.all([
    prisma.researchGroup.findUnique({
      where: { id },
      include: {
        ...summaryInclude,
        members: { include: { user: { select: userCardSelect } }, orderBy: { addedAt: 'asc' } },
        files: { include: { uploadedBy: { select: userCardSelect } }, orderBy: { createdAt: 'desc' } },
        channels: { orderBy: { createdAt: 'asc' } },
        activity: { include: { actor: { select: userCardSelect } }, orderBy: { createdAt: 'desc' }, take: 40 },
      },
    }),
    unreadByConversation(me.id),
  ]);
  if (!g) {
    notFound(res);
    return;
  }
  const moderate = canModerateGroup(access, me);
  const body: GroupDetail = {
    id: g.id,
    name: g.name,
    description: g.description,
    adviser: toUserCard(g.adviser),
    memberCount: g._count.members,
    fileCount: g._count.files,
    nextDeadline: nextDeadline(g.deadlines),
    isAdviser: g.adviserId === me.id,
    mySeat: seatOf(access, me),
    members: g.members.map((m) => ({ ...toUserCard(m.user), addedAt: m.addedAt.toISOString(), groupRole: m.role })),
    files: g.files.map((f) => ({
      id: f.id,
      name: f.name,
      size: f.size,
      type: f.type,
      uploadedBy: toUserCard(f.uploadedBy),
      createdAt: f.createdAt.toISOString(),
      canDelete: f.uploadedById === me.id || moderate,
    })),
    deadlines: g.deadlines.map((d) => ({ id: d.id, title: d.title, dueAt: d.dueAt.toISOString() })),
    // #general first, then the rest in the order they were opened.
    channels: [...g.channels]
      .sort((a, b) => Number(b.name === 'general') - Number(a.name === 'general'))
      .map((c) => ({ id: c.id, name: c.name, unread: unread.get(c.id) ?? 0, lastMessageAt: c.lastMessageAt.toISOString() })),
    activity: g.activity.map((a) => ({ id: a.id, action: a.action, detail: a.detail, actor: toUserCard(a.actor), createdAt: a.createdAt.toISOString() })),
    can: { manage: canManageGroup(access, me), moderate, organize: canOrganizeGroup(access, me), announce: canAnnounceToGroup(access, me) },
  };
  res.json(body);
});

groupsRouter.patch('/:id', async (req, res) => {
  const input = groupSchema.parse(req.body);
  const g = await loadGroup(idParam.parse(req.params.id), req.user!);
  if (!g || !canManageGroup(g, req.user!)) {
    notFound(res);
    return;
  }
  await prisma.researchGroup.update({ where: { id: g.id }, data: input });
  res.status(204).end();
});

groupsRouter.delete('/:id', async (req, res) => {
  const g = await loadGroup(idParam.parse(req.params.id), req.user!);
  if (!g || !canManageGroup(g, req.user!)) {
    notFound(res);
    return;
  }
  const files = await prisma.groupFile.findMany({ where: { groupId: g.id }, select: { file: true } });
  await prisma.researchGroup.delete({ where: { id: g.id } });
  await Promise.all(files.map((f) => deleteUpload(f.file)));
  res.status(204).end();
});

// ---------- Members and roles ----------

/** Students join as members; verified educators join as mentors. */
groupsRouter.post('/:id/members', async (req, res) => {
  const { userId } = memberSchema.parse(req.body);
  const me = req.user!;
  const g = await loadGroup(idParam.parse(req.params.id), me);
  if (!g || !canManageGroup(g, me)) {
    notFound(res);
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.id === g.adviserId || !(user.role === 'student' || (user.role === 'educator' && user.verified))) {
    res.status(400).json({ error: 'Add students as members, or verified educators as mentors.' });
    return;
  }
  const role = user.role === 'educator' ? 'mentor' : 'member';
  await prisma.groupMember.upsert({ where: { groupId_userId: { groupId: g.id, userId } }, create: { groupId: g.id, userId, role }, update: {} });
  await joinGroupChannels(g.id, userId);
  await logActivity(g.id, me.id, 'member_added', `${me.name} added ${user.name} as ${roleName[role]}.`);
  await notify(userId, 'group_added', `${me.name} added you to the research group “${g.name}” as ${roleName[role]}.`, `/groups/${g.id}`, me.id);
  res.status(201).end();
});

/** Students switch between member and group leader (one leader per group); educators stay mentors. */
groupsRouter.patch('/:id/members/:userId', async (req, res) => {
  const { role } = memberRoleSchema.parse(req.body);
  const me = req.user!;
  const userId = idParam.parse(req.params.userId);
  const g = await loadGroup(idParam.parse(req.params.id), me);
  const member = g?.members.find((m) => m.userId === userId);
  if (!g || !member || !canManageGroup(g, me)) {
    notFound(res);
    return;
  }
  if ((member.role === 'mentor') !== (role === 'mentor')) {
    res.status(400).json({ error: 'Educators join as mentors; students are members or the group leader.' });
    return;
  }
  const user = (await prisma.user.findUnique({ where: { id: userId }, select: { name: true } }))!;
  await prisma.$transaction([
    ...(role === 'leader' ? [prisma.groupMember.updateMany({ where: { groupId: g.id, role: 'leader' }, data: { role: 'member' } })] : []),
    prisma.groupMember.update({ where: { groupId_userId: { groupId: g.id, userId } }, data: { role } }),
  ]);
  await logActivity(g.id, me.id, 'role_changed', `${me.name} made ${user.name} ${role === 'leader' ? 'the group leader' : `a ${roleName[role]}`}.`);
  await notify(userId, 'group_role', `You’re now ${role === 'leader' ? 'the group leader' : `a ${roleName[role]}`} in “${g.name}”.`, `/groups/${g.id}`, me.id);
  res.status(204).end();
});

/** A manager removes a member, or a member leaves. */
groupsRouter.delete('/:id/members/:userId', async (req, res) => {
  const me = req.user!;
  const userId = idParam.parse(req.params.userId);
  const g = await loadGroup(idParam.parse(req.params.id), me);
  if (!g || !(canManageGroup(g, me) || userId === me.id)) {
    notFound(res);
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
  const { count } = await prisma.groupMember.deleteMany({ where: { groupId: g.id, userId } });
  if (count && user) {
    await leaveGroupChannels(g.id, userId);
    await logActivity(g.id, me.id, userId === me.id ? 'member_left' : 'member_removed', userId === me.id ? `${user.name} left the group.` : `${me.name} removed ${user.name}.`);
  }
  res.status(204).end();
});

// ---------- Channels ----------

groupsRouter.post('/:id/channels', async (req, res) => {
  const { name } = channelSchema.parse(req.body);
  const me = req.user!;
  const g = await loadGroup(idParam.parse(req.params.id), me);
  if (!g || !canOrganizeGroup(g, me)) {
    notFound(res);
    return;
  }
  if (await prisma.conversation.findFirst({ where: { groupId: g.id, name } })) {
    res.status(409).json({ error: `There’s already a #${name} channel.` });
    return;
  }
  const c = await createChannel(g.id, name, participantIds(g));
  await logActivity(g.id, me.id, 'channel_created', `${me.name} opened #${name}.`);
  res.status(201).json({ id: c.id });
});

/** Deleting a channel deletes its messages; files shared in it stay in the group's files. #general stays. */
groupsRouter.delete('/:id/channels/:channelId', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(idParam.parse(req.params.id), me);
  const c = g ? await prisma.conversation.findFirst({ where: { id: idParam.parse(req.params.channelId), groupId: g.id } }) : null;
  if (!g || !c || !canManageGroup(g, me)) {
    notFound(res);
    return;
  }
  if (c.name === 'general') {
    res.status(409).json({ error: '#general can’t be deleted.' });
    return;
  }
  await prisma.message.deleteMany({ where: { conversationId: c.id, parentId: { not: null } } });
  await prisma.conversation.delete({ where: { id: c.id } });
  await logActivity(g.id, me.id, 'channel_deleted', `${me.name} deleted #${c.name}.`);
  res.status(204).end();
});

// ---------- Files ----------

groupsRouter.post('/:id/files', rawBody, async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(idParam.parse(req.params.id), me);
  if (!g) {
    notFound(res);
    return;
  }
  const upload = readUpload(req, 'any');
  const file = await saveUpload(upload);
  await prisma.groupFile.create({
    data: { groupId: g.id, uploadedById: me.id, name: upload.name, file, type: storedType(req.get('content-type')), size: upload.buffer.length },
  });
  await logActivity(g.id, me.id, 'file_shared', `${me.name} shared ${upload.name}.`);
  res.status(201).end();
});

groupsRouter.get('/:id/files/:fileId', async (req, res) => {
  const g = await loadGroup(idParam.parse(req.params.id), req.user!);
  const f = g ? await prisma.groupFile.findFirst({ where: { id: idParam.parse(req.params.fileId), groupId: g.id } }) : null;
  if (!f) {
    notFound(res);
    return;
  }
  sendUpload(res, f.file, { type: f.type, name: f.name, download: req.query.download === '1' || f.type !== 'application/pdf' });
});

groupsRouter.delete('/:id/files/:fileId', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(idParam.parse(req.params.id), me);
  const f = g ? await prisma.groupFile.findFirst({ where: { id: idParam.parse(req.params.fileId), groupId: g.id } }) : null;
  if (!g || !f || !(f.uploadedById === me.id || canModerateGroup(g, me))) {
    notFound(res);
    return;
  }
  await prisma.groupFile.delete({ where: { id: f.id } });
  await deleteUpload(f.file);
  await logActivity(g.id, me.id, 'file_deleted', `${me.name} deleted ${f.name}.`);
  res.status(204).end();
});

// ---------- Deadlines ----------

groupsRouter.post('/:id/deadlines', async (req, res) => {
  const input = deadlineSchema.parse(req.body);
  const me = req.user!;
  const g = await loadGroup(idParam.parse(req.params.id), me);
  if (!g || !canOrganizeGroup(g, me)) {
    notFound(res);
    return;
  }
  await prisma.groupDeadline.create({ data: { ...input, groupId: g.id } });
  await logActivity(g.id, me.id, 'deadline_added', `${me.name} added the deadline “${input.title}”.`);
  await notify(participantIds(g), 'group_deadline', `New deadline in “${g.name}”: ${input.title}.`, `/groups/${g.id}`, me.id);
  res.status(201).end();
});

groupsRouter.delete('/:id/deadlines/:deadlineId', async (req, res) => {
  const me = req.user!;
  const g = await loadGroup(idParam.parse(req.params.id), me);
  if (!g || !canOrganizeGroup(g, me)) {
    notFound(res);
    return;
  }
  await prisma.groupDeadline.deleteMany({ where: { id: idParam.parse(req.params.deadlineId), groupId: g.id } });
  res.status(204).end();
});
