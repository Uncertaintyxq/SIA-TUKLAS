/**
 * Admin routes — the back office mounted at /api/admin, open to admins only.
 * Groups: dashboard stats and queue, people, educator monitoring, and moderation of events, ads, honors and works.
 */
import { Router, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { requireAuth, requireRole } from '../auth/middleware.js';
import { notify } from '../lib/notify.js';
import { isOnline } from '../realtime.js';
import { adInclude, eventCardInclude, toAdCard, toEventCard, toUserCard, userCardSelect } from '../lib/serialize.js';
import { idParam } from '../schemas/common.js';
import {
  removeSchema,
  userPatchSchema,
  type AdminEducators,
  type AdminPosts,
  type AdminQueue,
  type AdminStats,
  type AdminUser,
  type EducatorActivity,
} from '../schemas/admin.js';
import { myWorkInclude, toMyWork } from './works.js';

/** The admin dashboard: verification, moderation and platform stats. Every route is admin-only. */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireRole('admin'));

const missing = (res: Response, what: string) => res.status(404).json({ error: `That ${what} no longer exists.` });

// ---------- Dashboard ----------

adminRouter.get('/stats', async (_req, res) => {
  const now = new Date();
  const [roles, unverified, works, removed, events, registrations, liveAds, pendingAds, honors, groups, publications, announcements] = await Promise.all([
    prisma.user.groupBy({ by: ['role'], _count: { _all: true } }),
    prisma.user.count({ where: { role: 'educator', verified: false } }),
    prisma.work.groupBy({ by: ['status'], where: { removedAt: null }, _count: { _all: true } }),
    prisma.work.count({ where: { removedAt: { not: null } } }),
    prisma.event.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.eventRegistration.count(),
    prisma.ad.count({ where: { status: 'approved', startsAt: { lte: now }, endsAt: { gte: now } } }),
    prisma.ad.count({ where: { status: 'pending' } }),
    prisma.honor.count({ where: { verified: false } }),
    prisma.researchGroup.count(),
    prisma.publication.groupBy({ by: ['visibility'], _count: { _all: true } }),
    prisma.announcement.count(),
  ]);
  const byRole = (r: string) => roles.find((x) => x.role === r)?._count._all ?? 0;
  const byStatus = (...s: string[]) => works.filter((x) => s.includes(x.status)).reduce((n, x) => n + x._count._all, 0);
  const eventsBy = (s: string) => events.find((x) => x.status === s)?._count._all ?? 0;
  const body: AdminStats = {
    users: { student: byRole('student'), educator: byRole('educator'), admin: byRole('admin') },
    unverifiedEducators: unverified,
    works: {
      published: byStatus('approved'),
      inReview: byStatus('submitted', 'under_review', 'revision'),
      drafts: byStatus('draft'),
      rejected: byStatus('rejected'),
      removed,
    },
    events: { approved: eventsBy('approved'), pending: eventsBy('pending'), registrations },
    ads: { live: liveAds, pending: pendingAds },
    honorsPending: honors,
    groups,
    publications: {
      published: publications.filter((x) => x.visibility !== 'draft').reduce((n, x) => n + x._count._all, 0),
      drafts: publications.find((x) => x.visibility === 'draft')?._count._all ?? 0,
    },
    announcements,
  };
  res.json(body);
});

adminRouter.get('/queue', async (req, res) => {
  const me = req.user!;
  const [works, educators, events, ads, honors] = await Promise.all([
    prisma.work.findMany({
      where: { status: { in: ['submitted', 'under_review', 'revision'] }, removedAt: null },
      include: myWorkInclude(me.id),
      orderBy: { submittedAt: 'asc' },
    }),
    prisma.user.findMany({
      where: { role: 'educator', verified: false },
      select: { ...userCardSelect, email: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.event.findMany({ where: { status: 'pending' }, include: eventCardInclude(me.id), orderBy: { date: 'asc' } }),
    prisma.ad.findMany({ where: { status: 'pending' }, include: adInclude, orderBy: { createdAt: 'asc' } }),
    prisma.honor.findMany({ where: { verified: false }, include: { user: { select: userCardSelect } }, orderBy: { createdAt: 'asc' } }),
  ]);
  const body: AdminQueue = {
    works: works.map((w) => toMyWork(w, me.id)),
    educators: educators.map((u) => ({ ...toUserCard(u), email: u.email, createdAt: u.createdAt.toISOString() })),
    events: events.map(toEventCard),
    ads: ads.map(toAdCard),
    honors: honors.map((h) => ({ id: h.id, kind: h.kind, title: h.title, issuer: h.issuer, year: h.year, verified: h.verified, owner: toUserCard(h.user) })),
  };
  res.json(body);
});

// ---------- People ----------

const usersQuery = z.object({ q: z.string().trim().max(80).catch(''), role: z.enum(['student', 'educator', 'admin']).optional().catch(undefined) });

adminRouter.get('/users', async (req, res) => {
  const { q, role } = usersQuery.parse(req.query);
  const users = await prisma.user.findMany({
    where: { role, ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { username: { contains: q } }] } : {}) },
    select: { ...userCardSelect, email: true, createdAt: true, _count: { select: { works: true } } },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
    take: 200,
  });
  const body: AdminUser[] = users.map((u) => ({ ...toUserCard(u), email: u.email, createdAt: u.createdAt.toISOString(), works: u._count.works }));
  res.json(body);
});

const rightNames = { canPublish: 'research publishing', canModerateGroups: 'group moderation', canBroadcast: 'announcement' } as const;

/** Role, educator verification and educator rights. Making someone an educator vouches for them. */
adminRouter.patch('/users/:id', async (req, res) => {
  const patch = userPatchSchema.parse(req.body);
  const me = req.user!;
  const id = idParam.parse(req.params.id);
  if (id === me.id && patch.role && patch.role !== 'admin') {
    res.status(409).json({ error: 'You can’t remove your own admin role.' });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    missing(res, 'account');
    return;
  }
  const updated = await prisma.user.update({
    where: { id },
    data: {
      role: patch.role,
      verified: patch.verified ?? (patch.role === 'educator' && user.role !== 'educator' ? true : undefined),
      canPublish: patch.canPublish,
      canModerateGroups: patch.canModerateGroups,
      canBroadcast: patch.canBroadcast,
    },
  });
  if (updated.role === 'educator' && updated.verified && !(user.role === 'educator' && user.verified)) {
    await notify(id, 'educator_verified', 'Your educator account is verified. You can now review work, publish research and post announcements.', '/review', me.id);
  }
  for (const key of Object.keys(rightNames) as (keyof typeof rightNames)[]) {
    if (patch[key] === undefined || patch[key] === user[key]) continue;
    await notify(
      id,
      'educator_rights',
      patch[key] ? `An admin gave you the ${rightNames[key]} right.` : `An admin turned off your ${rightNames[key]} right.`,
      '/portfolio',
      me.id,
    );
  }
  res.status(204).end();
});

// ---------- Educator monitoring ----------

/** Every educator with their rights and output, plus the latest things educators did. */
adminRouter.get('/educators', async (_req, res) => {
  const educators = await prisma.user.findMany({
    where: { role: 'educator' },
    select: {
      ...userCardSelect,
      email: true,
      createdAt: true,
      lastSeenAt: true,
      canPublish: true,
      canModerateGroups: true,
      canBroadcast: true,
      _count: { select: { advisedGroups: true, announcements: true, reviews: true } },
    },
    orderBy: { name: 'asc' },
  });
  const ids = educators.map((e) => e.id);
  const [byVisibility, publications, announcements, reviews, groups] = await Promise.all([
    prisma.publication.groupBy({ by: ['authorId', 'visibility'], where: { authorId: { in: ids } }, _count: { _all: true } }),
    prisma.publication.findMany({
      where: { authorId: { in: ids }, visibility: { not: 'draft' } },
      select: { id: true, title: true, visibility: true, publishedAt: true, author: { select: userCardSelect } },
      orderBy: { publishedAt: 'desc' },
      take: 15,
    }),
    prisma.announcement.findMany({
      where: { authorId: { in: ids } },
      select: { id: true, title: true, createdAt: true, author: { select: userCardSelect } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    prisma.review.findMany({
      where: { reviewerId: { in: ids }, decision: { not: 'start_review' } },
      select: { id: true, decision: true, createdAt: true, work: { select: { id: true, title: true } }, reviewer: { select: userCardSelect } },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
    prisma.researchGroup.findMany({
      where: { adviserId: { in: ids } },
      select: { id: true, name: true, createdAt: true, adviser: { select: userCardSelect } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
  ]);
  const count = (authorId: number, visibility: string) => byVisibility.find((x) => x.authorId === authorId && x.visibility === visibility)?._count._all ?? 0;
  const verb = { revise: 'returned', approve: 'approved', reject: 'did not approve' } as const;
  const recent: EducatorActivity[] = [
    ...publications.map((p) => ({
      key: `p${p.id}`,
      kind: 'publication' as const,
      educator: toUserCard(p.author),
      text: `published “${p.title}” (${p.visibility === 'public' ? 'Public' : 'Internal'})`,
      link: `/publications/${p.id}`,
      at: (p.publishedAt ?? new Date(0)).toISOString(),
    })),
    ...announcements.map((a) => ({
      key: `a${a.id}`,
      kind: 'announcement' as const,
      educator: toUserCard(a.author),
      text: `posted the announcement “${a.title}”`,
      link: `/announcements#a-${a.id}`,
      at: a.createdAt.toISOString(),
    })),
    ...reviews.map((r) => ({
      key: `r${r.id}`,
      kind: 'review' as const,
      educator: toUserCard(r.reviewer),
      text: `${verb[r.decision as keyof typeof verb] ?? 'reviewed'} “${r.work.title}”`,
      link: `/works/${r.work.id}`,
      at: r.createdAt.toISOString(),
    })),
    ...groups.map((g) => ({
      key: `g${g.id}`,
      kind: 'group' as const,
      educator: toUserCard(g.adviser),
      text: `started the research group “${g.name}”`,
      link: `/groups/${g.id}`,
      at: g.createdAt.toISOString(),
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 25);

  const body: AdminEducators = {
    educators: educators.map((e) => ({
      ...toUserCard(e),
      email: e.email,
      createdAt: e.createdAt.toISOString(),
      online: isOnline(e.id),
      lastSeenAt: e.lastSeenAt?.toISOString() ?? null,
      rights: { publish: e.canPublish, moderateGroups: e.canModerateGroups, broadcast: e.canBroadcast },
      counts: {
        publications: { draft: count(e.id, 'draft'), internal: count(e.id, 'internal'), public: count(e.id, 'public') },
        groups: e._count.advisedGroups,
        announcements: e._count.announcements,
        reviews: e._count.reviews,
      },
    })),
    recent,
  };
  res.json(body);
});

// ---------- Moderation ----------

async function decideEvent(id: number, approve: boolean, actorId: number) {
  const e = await prisma.event.findUnique({ where: { id } });
  if (!e) return false;
  await prisma.event.update({ where: { id }, data: { status: approve ? 'approved' : 'rejected' } });
  await notify(
    e.postedById,
    approve ? 'event_approved' : 'event_rejected',
    approve ? `“${e.title}” was approved and is now listed.` : `“${e.title}” wasn’t approved.`,
    `/events/${e.id}`,
    actorId,
  );
  return true;
}

const action = z.enum(['approve', 'reject']);

adminRouter.post('/events/:id/:action', async (req, res) => {
  const ok = await decideEvent(idParam.parse(req.params.id), action.parse(req.params.action) === 'approve', req.user!.id);
  if (!ok) missing(res, 'event');
  else res.status(204).end();
});

adminRouter.post('/ads/:id/:action', async (req, res) => {
  const approve = action.parse(req.params.action) === 'approve';
  const ad = await prisma.ad.findUnique({ where: { id: idParam.parse(req.params.id) }, include: { event: { select: { title: true, id: true } } } });
  if (!ad) {
    missing(res, 'ad');
    return;
  }
  await prisma.ad.update({ where: { id: ad.id }, data: { status: approve ? 'approved' : 'rejected' } });
  await notify(
    ad.createdById,
    approve ? 'ad_approved' : 'ad_rejected',
    approve ? `Your ad for “${ad.event.title}” is approved and will run in the feed.` : `Your ad for “${ad.event.title}” wasn’t approved.`,
    `/events/${ad.event.id}`,
    req.user!.id,
  );
  res.status(204).end();
});

adminRouter.post('/honors/:id/verify', async (req, res) => {
  const me = req.user!;
  const h = await prisma.honor.findUnique({ where: { id: idParam.parse(req.params.id) }, include: { user: { select: { username: true } } } });
  if (!h) {
    missing(res, 'honor');
    return;
  }
  await prisma.honor.update({ where: { id: h.id }, data: { verified: true, verifiedById: me.id, verifiedAt: new Date() } });
  await notify(h.userId, 'honor_verified', `“${h.title}” is verified and now shows on your public portfolio.`, '/portfolio', me.id);
  res.status(204).end();
});

/** Declining removes the claim, as in the prototype. */
adminRouter.post('/honors/:id/decline', async (req, res) => {
  const h = await prisma.honor.findUnique({ where: { id: idParam.parse(req.params.id) } });
  if (!h) {
    missing(res, 'honor');
    return;
  }
  await prisma.honor.delete({ where: { id: h.id } });
  await notify(h.userId, 'honor_declined', `“${h.title}” couldn’t be verified and was removed.`, '/portfolio', req.user!.id);
  res.status(204).end();
});

adminRouter.get('/posts', async (req, res) => {
  const me = req.user!;
  const [works, opportunities, comments] = await Promise.all([
    prisma.work.findMany({ where: { status: 'approved' }, include: myWorkInclude(me.id), orderBy: { approvedAt: 'desc' }, take: 100 }),
    prisma.opportunity.findMany({ include: { adviser: { select: userCardSelect } }, orderBy: { createdAt: 'desc' }, take: 100 }),
    prisma.comment.findMany({
      where: { scope: 'public' },
      include: { author: { select: userCardSelect }, work: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ]);
  const body: AdminPosts = {
    works: works.map((w) => ({ ...toMyWork(w, me.id), removedAt: w.removedAt?.toISOString() ?? null })),
    opportunities: opportunities.map((o) => ({ id: o.id, title: o.title, adviser: toUserCard(o.adviser), createdAt: o.createdAt.toISOString() })),
    comments: comments.map((c) => ({ id: c.id, text: c.text, author: toUserCard(c.author), work: c.work, createdAt: c.createdAt.toISOString() })),
  };
  res.json(body);
});

/** Takes a published work off the feed and portfolios; its authors still see it. */
adminRouter.post('/works/:id/remove', async (req, res) => {
  const { reason } = removeSchema.parse(req.body ?? {});
  const w = await prisma.work.findUnique({ where: { id: idParam.parse(req.params.id) }, include: { coAuthors: { select: { userId: true } } } });
  if (!w) {
    missing(res, 'work');
    return;
  }
  await prisma.work.update({ where: { id: w.id }, data: { removedAt: new Date() } });
  await notify(
    [w.authorId, ...w.coAuthors.map((c) => c.userId)],
    'work_removed',
    `An admin removed “${w.title}” from the feed${reason ? `: ${reason}` : '.'}`,
    `/works/${w.id}`,
    req.user!.id,
  );
  res.status(204).end();
});

adminRouter.post('/works/:id/restore', async (req, res) => {
  const { count } = await prisma.work.updateMany({ where: { id: idParam.parse(req.params.id) }, data: { removedAt: null } });
  res.status(count ? 204 : 404).end();
});
