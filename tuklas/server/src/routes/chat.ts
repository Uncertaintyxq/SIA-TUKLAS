/**
 * Communication & chat center: 1-on-1 messages between students and educators, and the text channels
 * of research groups. /api/chat/…  New messages reach open tabs through the WebSocket (src/realtime.ts).
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth } from '../auth/middleware.js';
import { announceMessage, chatPersonSelect, messageInclude, toChatPerson, toMessageView, unreadByConversation, type MessageRow } from '../lib/chat.js';
import { deleteUpload, rawBody, readUpload, saveUpload, sendUpload, storedType } from '../lib/files.js';
import { logActivity } from '../lib/groups.js';
import { canModerateGroup, canOpenGroup } from '../policies/groups.js';
import { idParam } from '../schemas/common.js';
import {
  directSchema,
  messageSchema,
  pageQuery,
  searchQuery,
  type ConversationPage,
  type ConversationSummary,
  type SearchHit,
  type ThreadView,
} from '../schemas/chat.js';

export const chatRouter = Router();
chatRouter.use(requireAuth);

const PAGE = 40;
/** Direct messages: Student ↔ Student, Student ↔ Educator, Educator ↔ Educator. */
const CHAT_ROLES = new Set(['student', 'educator']);

const notFound = (res: Response) => res.status(404).json({ error: 'That conversation doesn’t exist or you’re not in it.' });

// ---------- Access ----------

/**
 * Loads a conversation the user may open. Direct chats need a member row; channels follow group
 * membership, and an admin or a participant without a read marker yet gets one here.
 */
async function openConversation(id: number, me: User) {
  const c = await prisma.conversation.findUnique({
    where: { id },
    include: { group: { select: { id: true, name: true, adviserId: true, members: { select: { userId: true, role: true } } } } },
  });
  if (!c) return null;
  if (c.kind === 'direct') {
    const row = await prisma.conversationMember.findUnique({ where: { conversationId_userId: { conversationId: id, userId: me.id } } });
    return row ? c : null;
  }
  if (!c.group || !canOpenGroup(c.group, me)) return null;
  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId: id, userId: me.id } },
    create: { conversationId: id, userId: me.id },
    update: {},
  });
  return c;
}

type OpenConversation = NonNullable<Awaited<ReturnType<typeof openConversation>>>;

/** The sender can always remove their message; in a channel, so can the group's moderators. */
const mayDelete = (c: OpenConversation, m: Pick<MessageRow, 'senderId'>, me: User) =>
  m.senderId === me.id || me.role === 'admin' || Boolean(c.group && canModerateGroup(c.group, me));

async function summarize(c: OpenConversation, me: User, unread = 0): Promise<ConversationSummary> {
  const [other, last] = await Promise.all([
    c.kind === 'direct'
      ? prisma.conversationMember.findFirst({ where: { conversationId: c.id, userId: { not: me.id } }, select: { user: { select: chatPersonSelect } } })
      : null,
    prisma.message.findFirst({ where: { conversationId: c.id, deletedAt: null }, orderBy: { createdAt: 'desc' }, include: { sender: { select: { name: true } } } }),
  ]);
  const person = other ? toChatPerson(other.user) : null;
  return {
    id: c.id,
    kind: c.kind,
    name: c.kind === 'direct' ? (person?.name ?? 'Former member') : c.name,
    group: c.group ? { id: c.group.id, name: c.group.name } : null,
    other: person,
    lastMessage: last ? { text: last.text, senderName: last.sender.name, createdAt: last.createdAt.toISOString(), hasFile: Boolean(last.fileName) } : null,
    lastMessageAt: c.lastMessageAt.toISOString(),
    unread,
  };
}

// ---------- Conversations ----------

/** My direct chats and group channels, most recent first. */
chatRouter.get('/conversations', async (req, res) => {
  const me = req.user!;
  const rows = await prisma.conversationMember.findMany({
    where: { userId: me.id },
    include: {
      conversation: { include: { group: { select: { id: true, name: true, adviserId: true, members: { select: { userId: true, role: true } } } } } },
    },
  });
  const unread = await unreadByConversation(me.id);
  // A channel stays listed only while its group still has the person in it.
  const open = rows.map((r) => r.conversation).filter((c) => c.kind === 'direct' || (c.group && canOpenGroup(c.group, me)));
  const list = await Promise.all(open.map((c) => summarize(c, me, unread.get(c.id) ?? 0)));
  list.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  res.json(list);
});

/** Unread messages across every conversation, for the nav badge. */
chatRouter.get('/unread', async (req, res) => {
  const unread = await unreadByConversation(req.user!.id);
  res.json({ messages: [...unread.values()].reduce((n, x) => n + x, 0) });
});

/** Opens (or creates) the 1-on-1 chat with someone. */
chatRouter.post('/direct', async (req, res) => {
  const { userId } = directSchema.parse(req.body);
  const me = req.user!;
  if (userId === me.id) {
    res.status(400).json({ error: 'You can’t message yourself.' });
    return;
  }
  const other = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!other || !CHAT_ROLES.has(other.role) || !CHAT_ROLES.has(me.role)) {
    res.status(400).json({ error: 'Direct messages are between students and educators.' });
    return;
  }
  const directKey = [me.id, userId].sort((a, b) => a - b).join(':');
  const c = await prisma.conversation.upsert({
    where: { directKey },
    create: { kind: 'direct', directKey, members: { create: [{ userId: me.id }, { userId }] } },
    update: {},
  });
  res.json({ id: c.id });
});

/** The conversation header and its latest top-level messages; ?before=<messageId> pages back. */
chatRouter.get('/conversations/:id', async (req, res) => {
  const me = req.user!;
  const { before } = pageQuery.parse(req.query);
  const c = await openConversation(idParam.parse(req.params.id), me);
  if (!c) {
    notFound(res);
    return;
  }
  const rows = await prisma.message.findMany({
    where: { conversationId: c.id, parentId: null, ...(before ? { id: { lt: before } } : {}) },
    include: messageInclude,
    orderBy: { id: 'desc' },
    take: PAGE + 1,
  });
  const page = rows.slice(0, PAGE).reverse();
  const body: ConversationPage = {
    conversation: await summarize(c, me),
    messages: page.map((m) => toMessageView(m, mayDelete(c, m, me))),
    hasMore: rows.length > PAGE,
  };
  res.json(body);
});

/** Moves my read marker to now. */
chatRouter.post('/conversations/:id/read', async (req, res) => {
  const me = req.user!;
  const c = await openConversation(idParam.parse(req.params.id), me);
  if (!c) {
    notFound(res);
    return;
  }
  await prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: c.id, userId: me.id } }, data: { lastReadAt: new Date() } });
  res.status(204).end();
});

// ---------- Messages ----------

async function deliver(c: OpenConversation, me: User, m: MessageRow) {
  const now = new Date();
  await prisma.$transaction([
    prisma.conversation.update({ where: { id: c.id }, data: { lastMessageAt: now } }),
    prisma.conversationMember.update({ where: { conversationId_userId: { conversationId: c.id, userId: me.id } }, data: { lastReadAt: now } }),
  ]);
  await announceMessage(c.id, m.id, m.parentId);
}

chatRouter.post('/conversations/:id/messages', async (req, res) => {
  const { text, parentId } = messageSchema.parse(req.body);
  const me = req.user!;
  const c = await openConversation(idParam.parse(req.params.id), me);
  if (!c) {
    notFound(res);
    return;
  }
  if (parentId && !(await prisma.message.findFirst({ where: { id: parentId, conversationId: c.id, parentId: null, deletedAt: null } }))) {
    res.status(400).json({ error: 'The message you’re replying to was removed.' });
    return;
  }
  const m = await prisma.message.create({ data: { conversationId: c.id, senderId: me.id, parentId: parentId ?? null, text }, include: messageInclude });
  await deliver(c, me, m);
  res.status(201).json(toMessageView(m, true));
});

/**
 * Sends a file (raw body, name in X-File-Name; optional caption in ?text=). In a channel the file joins the
 * group's shared repository, so it also appears under the group's files.
 */
chatRouter.post('/conversations/:id/files', rawBody, async (req, res) => {
  const me = req.user!;
  const c = await openConversation(idParam.parse(req.params.id), me);
  if (!c) {
    notFound(res);
    return;
  }
  const upload = readUpload(req, 'any');
  const caption = z.string().trim().max(4000).catch('').parse(req.query.text ?? '');
  const type = storedType(req.get('content-type'));
  const file = await saveUpload(upload);
  const fileFields = { fileName: upload.name, fileType: type, fileSize: upload.buffer.length };

  let data;
  if (c.group) {
    const shared = await prisma.groupFile.create({ data: { groupId: c.group.id, uploadedById: me.id, name: upload.name, file, type, size: upload.buffer.length } });
    await logActivity(c.group.id, me.id, 'file_shared', `${me.name} shared ${upload.name} in #${c.name}`);
    data = { ...fileFields, groupFileId: shared.id };
  } else {
    data = { ...fileFields, file };
  }
  const m = await prisma.message.create({ data: { conversationId: c.id, senderId: me.id, text: caption, ...data }, include: messageInclude });
  await deliver(c, me, m);
  res.status(201).json(toMessageView(m, true));
});

/** A thread: the message and its replies, oldest first. */
chatRouter.get('/messages/:id/replies', async (req, res) => {
  const me = req.user!;
  const parent = await prisma.message.findUnique({ where: { id: idParam.parse(req.params.id) }, include: messageInclude });
  const c = parent && !parent.parentId ? await openConversation(parent.conversationId, me) : null;
  if (!parent || !c) {
    notFound(res);
    return;
  }
  const replies = await prisma.message.findMany({ where: { parentId: parent.id }, include: messageInclude, orderBy: { id: 'asc' } });
  const body: ThreadView = {
    parent: toMessageView(parent, mayDelete(c, parent, me)),
    replies: replies.map((m) => toMessageView(m, mayDelete(c, m, me))),
  };
  res.json(body);
});

chatRouter.get('/messages/:id/file', async (req, res) => {
  const m = await prisma.message.findUnique({ where: { id: idParam.parse(req.params.id) }, include: { groupFile: true } });
  const c = m && !m.deletedAt ? await openConversation(m.conversationId, req.user!) : null;
  const file = m?.groupFile?.file ?? m?.file;
  if (!m || !c || !file) {
    notFound(res);
    return;
  }
  const type = m.groupFile?.type ?? m.fileType ?? 'application/octet-stream';
  const viewable = type === 'application/pdf' || type.startsWith('image/');
  sendUpload(res, file, { type, name: m.fileName ?? 'file', download: req.query.download === '1' || !viewable });
});

/** Removes a message for everyone. A direct-chat file goes with it; a channel file stays in the group's files. */
chatRouter.delete('/messages/:id', async (req, res) => {
  const me = req.user!;
  const m = await prisma.message.findUnique({ where: { id: idParam.parse(req.params.id) } });
  const c = m && !m.deletedAt ? await openConversation(m.conversationId, me) : null;
  if (!m || !c) {
    notFound(res);
    return;
  }
  if (!mayDelete(c, m, me)) {
    res.status(403).json({ error: 'Only the sender or a group moderator can remove this message.' });
    return;
  }
  await prisma.message.update({
    where: { id: m.id },
    data: { deletedAt: new Date(), text: '', file: null, fileName: null, fileType: null, fileSize: null, groupFileId: null },
  });
  await deleteUpload(m.file);
  await announceMessage(c.id, m.id, m.parentId, true);
  res.status(204).end();
});

// ---------- Search ----------

/** Searches the text of every conversation I'm in, newest first. */
chatRouter.get('/search', async (req, res) => {
  const me = req.user!;
  const parsed = searchQuery.safeParse(req.query);
  if (!parsed.success) {
    res.json([]);
    return;
  }
  const hits = await prisma.message.findMany({
    where: { deletedAt: null, text: { contains: parsed.data.q }, conversation: { members: { some: { userId: me.id } } } },
    include: {
      ...messageInclude,
      conversation: {
        select: {
          id: true,
          kind: true,
          name: true,
          group: { select: { id: true, name: true } },
          members: { where: { userId: { not: me.id } }, select: { user: { select: { name: true } } }, take: 1 },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const body: SearchHit[] = hits.map(({ conversation: c, ...m }) => ({
    message: toMessageView(m, false),
    conversation: { id: c.id, kind: c.kind, name: c.kind === 'direct' ? (c.members[0]?.user.name ?? 'Former member') : c.name, group: c.group },
  }));
  res.json(body);
});
