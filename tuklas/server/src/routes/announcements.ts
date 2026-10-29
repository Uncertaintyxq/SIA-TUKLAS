/**
 * Announcements: system-wide (admins), one department, or one research group (educators with the broadcast
 * right, and admins). Posting sends an in-app notification and an email; readers leave a read receipt.
 */
import { Router, type Response } from 'express';
import type { Announcement, Prisma, User } from '@prisma/client';
import { prisma } from '../db.js';
import { env } from '../env.js';
import { requireAuth } from '../auth/middleware.js';
import { deleteUpload, rawBody, readUpload, saveUpload, sendUpload, storedType } from '../lib/files.js';
import { logActivity } from '../lib/groups.js';
import { sendMail } from '../lib/mailer.js';
import { toPlainText } from '../lib/markup.js';
import { notify } from '../lib/notify.js';
import { toUserCard, userCardSelect } from '../lib/serialize.js';
import { canAnnounceToGroup } from '../policies/groups.js';
import { hasRight } from '../policies/rights.js';
import {
  announcementPatchSchema,
  announcementSchema,
  announcementsQuery,
  type AnnouncementsResponse,
  type AnnouncementView,
  type ReceiptsView,
} from '../schemas/announcements.js';
import { idParam } from '../schemas/common.js';

export const announcementsRouter = Router();
announcementsRouter.use(requireAuth);

const MAX_ATTACHMENTS = 5;
const notFound = (res: Response) => res.status(404).json({ error: 'That announcement doesn’t exist or isn’t for you.' });

const include = {
  author: { select: userCardSelect },
  group: { select: { id: true, name: true } },
  attachments: { orderBy: { id: 'asc' as const } },
} satisfies Prisma.AnnouncementInclude;

// ---------- Audiences ----------

async function departmentOf(userId: number) {
  const p = await prisma.profile.findUnique({ where: { userId }, select: { department: true } });
  return p?.department.trim() ?? '';
}

/** What the viewer may read, as a filter: everything for admins; otherwise system-wide, my department, my groups, my own. */
async function visibleTo(me: User): Promise<Prisma.AnnouncementWhereInput> {
  if (me.role === 'admin') return {};
  const [department, groups] = await Promise.all([
    departmentOf(me.id),
    prisma.researchGroup.findMany({ where: { OR: [{ adviserId: me.id }, { members: { some: { userId: me.id } } }] }, select: { id: true } }),
  ]);
  return {
    OR: [
      { scope: 'system' },
      ...(department ? [{ scope: 'department' as const, department }] : []),
      { scope: 'group', groupId: { in: groups.map((g) => g.id) } },
      { authorId: me.id },
    ],
  };
}

/** Everyone an announcement is for. */
async function audienceOf(a: Pick<Announcement, 'scope' | 'department' | 'groupId'>): Promise<number[]> {
  if (a.scope === 'system') return (await prisma.user.findMany({ select: { id: true } })).map((u) => u.id);
  if (a.scope === 'department')
    return (await prisma.profile.findMany({ where: { department: a.department ?? '' }, select: { userId: true } })).map((p) => p.userId);
  const g = await prisma.researchGroup.findUnique({ where: { id: a.groupId ?? 0 }, select: { adviserId: true, members: { select: { userId: true } } } });
  return g ? [g.adviserId, ...g.members.map((m) => m.userId)] : [];
}

const audienceLabel = (a: Pick<Announcement, 'scope' | 'department'> & { group: { name: string } | null }) =>
  a.scope === 'system' ? 'Everyone' : a.scope === 'department' ? (a.department ?? 'Department') : (a.group?.name ?? 'Research group');

/** Where the viewer may post. */
async function audiencesFor(me: User): Promise<AnnouncementsResponse['audiences']> {
  if (me.role === 'admin') {
    const [departments, groups] = await Promise.all([
      prisma.profile.findMany({ where: { department: { not: '' } }, distinct: ['department'], select: { department: true }, orderBy: { department: 'asc' } }),
      prisma.researchGroup.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    ]);
    return { system: true, departments: departments.map((d) => d.department), groups };
  }
  if (!hasRight(me, 'broadcast')) return { system: false, departments: [], groups: [] };
  const [department, groups] = await Promise.all([
    departmentOf(me.id),
    prisma.researchGroup.findMany({
      where: { OR: [{ adviserId: me.id }, { members: { some: { userId: me.id, role: 'mentor' } } }] },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);
  return { system: false, departments: department ? [department] : [], groups };
}

const canEdit = (a: Pick<Announcement, 'authorId'>, me: User) => a.authorId === me.id || me.role === 'admin';

async function loadVisible(id: number, me: User) {
  return prisma.announcement.findFirst({ where: { AND: [{ id }, await visibleTo(me)] }, include });
}

// ---------- Reading ----------

announcementsRouter.get('/', async (req, res) => {
  const me = req.user!;
  const { scope, groupId } = announcementsQuery.parse(req.query);
  const visible = await visibleTo(me);
  const [rows, unread, audiences] = await Promise.all([
    prisma.announcement.findMany({
      where: { AND: [visible, scope ? { scope } : {}, groupId ? { groupId } : {}] },
      include: { ...include, reads: { where: { userId: me.id }, select: { userId: true } } },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    }),
    prisma.announcement.count({ where: { AND: [visible, { authorId: { not: me.id } }, { reads: { none: { userId: me.id } } }] } }),
    audiencesFor(me),
  ]);

  // Receipts only for what I wrote (or anything, for admins). Audiences repeat, so look each up once.
  const audiences$ = new Map<string, Promise<number[]>>();
  const items: AnnouncementView[] = await Promise.all(
    rows.map(async (a) => {
      let receipts: AnnouncementView['receipts'] = null;
      if (canEdit(a, me)) {
        const key = `${a.scope}:${a.department ?? ''}:${a.groupId ?? ''}`;
        if (!audiences$.has(key)) audiences$.set(key, audienceOf(a));
        const ids = (await audiences$.get(key)!).filter((id) => id !== a.authorId);
        const read = await prisma.announcementRead.count({ where: { announcementId: a.id, userId: { in: ids } } });
        receipts = { read, total: ids.length };
      }
      return {
        id: a.id,
        scope: a.scope,
        audience: audienceLabel(a),
        group: a.group,
        title: a.title,
        body: a.body,
        pinned: a.pinned,
        createdAt: a.createdAt.toISOString(),
        updatedAt: a.updatedAt.toISOString(),
        author: toUserCard(a.author),
        attachments: a.attachments.map(({ id, name, size, type }) => ({ id, name, size, type })),
        read: a.authorId === me.id || a.reads.length > 0,
        receipts,
        can: { edit: canEdit(a, me), delete: canEdit(a, me) },
      };
    }),
  );
  const body: AnnouncementsResponse = { items, unread, audiences };
  res.json(body);
});

/** Unread count for the nav badge. */
announcementsRouter.get('/unread', async (req, res) => {
  const me = req.user!;
  const count = await prisma.announcement.count({ where: { AND: [await visibleTo(me), { authorId: { not: me.id } }, { reads: { none: { userId: me.id } } }] } });
  res.json({ count });
});

/** The read receipt: sent once the announcement has been on the reader's screen. */
announcementsRouter.post('/:id/read', async (req, res) => {
  const me = req.user!;
  const a = await loadVisible(idParam.parse(req.params.id), me);
  if (!a) {
    notFound(res);
    return;
  }
  await prisma.announcementRead.createMany({ data: [{ announcementId: a.id, userId: me.id }], skipDuplicates: true });
  res.status(204).end();
});

/** Who has and hasn't read it: for the author and admins. */
announcementsRouter.get('/:id/receipts', async (req, res) => {
  const me = req.user!;
  const a = await loadVisible(idParam.parse(req.params.id), me);
  if (!a || !canEdit(a, me)) {
    notFound(res);
    return;
  }
  const ids = (await audienceOf(a)).filter((id) => id !== a.authorId);
  const [people, reads] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: ids } }, select: userCardSelect, orderBy: { name: 'asc' } }),
    prisma.announcementRead.findMany({ where: { announcementId: a.id }, select: { userId: true, readAt: true } }),
  ]);
  const readAt = new Map(reads.map((r) => [r.userId, r.readAt.toISOString()]));
  const body: ReceiptsView = {
    read: people.filter((p) => readAt.has(p.id)).map((p) => ({ ...toUserCard(p), readAt: readAt.get(p.id)! })),
    unread: people.filter((p) => !readAt.has(p.id)).map(toUserCard),
  };
  body.read.sort((x, y) => y.readAt.localeCompare(x.readAt));
  res.json(body);
});

// ---------- Posting ----------

announcementsRouter.post('/', async (req, res) => {
  const input = announcementSchema.parse(req.body);
  const me = req.user!;
  let department: string | null = null;
  let groupId: number | null = null;

  if (input.scope === 'system') {
    if (me.role !== 'admin') {
      res.status(403).json({ error: 'Only admins can post to everyone.' });
      return;
    }
  } else if (input.scope === 'department') {
    if (!hasRight(me, 'broadcast')) {
      res.status(403).json({ error: 'An admin has to give you the announcement right first.' });
      return;
    }
    department = me.role === 'admin' ? (input.department?.trim() ?? '') : await departmentOf(me.id);
    if (!department) {
      res.status(400).json({ error: me.role === 'admin' ? 'Choose a department.' : 'Add your department to your portfolio first.' });
      return;
    }
  } else {
    const g = await prisma.researchGroup.findUnique({ where: { id: input.groupId ?? 0 }, include: { members: { select: { userId: true, role: true } } } });
    if (!g || !canAnnounceToGroup(g, me)) {
      res.status(403).json({ error: 'You can only announce to groups you advise or mentor.' });
      return;
    }
    groupId = g.id;
  }

  const a = await prisma.announcement.create({
    data: { authorId: me.id, scope: input.scope, department, groupId, title: input.title, body: input.body, pinned: input.pinned },
    include,
  });
  if (groupId) await logActivity(groupId, me.id, 'announcement_posted', `${me.name} posted “${a.title}”.`);

  // In-app notification (pushed to open tabs) and an email to everyone in the audience.
  const ids = (await audienceOf(a)).filter((id) => id !== me.id);
  await notify(ids, 'announcement', `${me.name} posted an announcement: “${a.title}”`, `/announcements#a-${a.id}`, me.id);
  const recipients = await prisma.user.findMany({ where: { id: { in: ids } }, select: { email: true } });
  sendMail(
    recipients.map((r) => r.email),
    `[Tuklas] ${a.title}`,
    `${me.name} posted an announcement for ${audienceLabel(a)}:\n\n${toPlainText(a.body)}\n\nRead it on Tuklas: ${env.APP_URL}/announcements#a-${a.id}`,
  );
  res.status(201).json({ id: a.id });
});

announcementsRouter.patch('/:id', async (req, res) => {
  const patch = announcementPatchSchema.parse(req.body);
  const me = req.user!;
  const a = await loadVisible(idParam.parse(req.params.id), me);
  if (!a || !canEdit(a, me)) {
    notFound(res);
    return;
  }
  await prisma.announcement.update({ where: { id: a.id }, data: patch });
  res.status(204).end();
});

announcementsRouter.delete('/:id', async (req, res) => {
  const me = req.user!;
  const a = await loadVisible(idParam.parse(req.params.id), me);
  if (!a || !canEdit(a, me)) {
    notFound(res);
    return;
  }
  await prisma.announcement.delete({ where: { id: a.id } });
  await Promise.all(a.attachments.map((f) => deleteUpload(f.file)));
  res.status(204).end();
});

// ---------- Attachments ----------

announcementsRouter.post('/:id/attachments', rawBody, async (req, res) => {
  const me = req.user!;
  const a = await loadVisible(idParam.parse(req.params.id), me);
  if (!a || !canEdit(a, me)) {
    notFound(res);
    return;
  }
  if (a.attachments.length >= MAX_ATTACHMENTS) {
    res.status(409).json({ error: `An announcement can have up to ${MAX_ATTACHMENTS} attachments.` });
    return;
  }
  const upload = readUpload(req, 'any');
  const file = await saveUpload(upload);
  await prisma.announcementAttachment.create({
    data: { announcementId: a.id, name: upload.name, file, type: storedType(req.get('content-type')), size: upload.buffer.length },
  });
  res.status(201).end();
});

announcementsRouter.get('/:id/attachments/:attachmentId', async (req, res) => {
  const a = await loadVisible(idParam.parse(req.params.id), req.user!);
  const f = a?.attachments.find((x) => x.id === idParam.parse(req.params.attachmentId));
  if (!f) {
    notFound(res);
    return;
  }
  sendUpload(res, f.file, { type: f.type, name: f.name, download: req.query.download === '1' || f.type !== 'application/pdf' });
});

announcementsRouter.delete('/:id/attachments/:attachmentId', async (req, res) => {
  const me = req.user!;
  const a = await loadVisible(idParam.parse(req.params.id), me);
  const f = a?.attachments.find((x) => x.id === idParam.parse(req.params.attachmentId));
  if (!a || !f || !canEdit(a, me)) {
    notFound(res);
    return;
  }
  await prisma.announcementAttachment.delete({ where: { id: f.id } });
  await deleteUpload(f.file);
  res.status(204).end();
});
