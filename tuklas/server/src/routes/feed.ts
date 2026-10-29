/**
 * Feed routes — the home feed, its sidebar, and adviser opportunities.
 * Mounted at /api/feed (feed and sidebar) and /api/opportunities (posting, applying, withdrawing).
 */
import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db.js';
import { requireAuth, requireRole, requireVerified } from '../auth/middleware.js';
import { notify } from '../lib/notify.js';
import {
  adInclude,
  eventCardInclude,
  opportunityInclude,
  toAdCard,
  toEventCard,
  toOpportunityCard,
  toUserCard,
  toWorkCard,
  userCardSelect,
  workCardInclude,
} from '../lib/serialize.js';
import { publicWork } from '../policies/works.js';
import { idParam } from '../schemas/common.js';
import {
  applicationSchema,
  feedQuery,
  opportunitySchema,
  type FeedItem,
  type FeedResponse,
  type MyOpportunity,
  type SidebarResponse,
} from '../schemas/feed.js';
import { workTypes, type WorkType } from '../schemas/works.js';

// ---------- Feed ----------

export const feedRouter = Router();
feedRouter.use(requireAuth);

const DAY = 86_400_000;
const likeEscape = (q: string) => q.replace(/[\\%_]/g, '\\$&');

/** Ids of public works with a keyword containing `q` (keywords are a JSON array, so plain Prisma filters can't reach them). */
async function keywordMatches(q: string): Promise<number[]> {
  const rows = await prisma.$queryRaw<{ id: number }[]>`
    SELECT id FROM works
    WHERE status = 'approved' AND removedAt IS NULL
      AND LOWER(CAST(tags AS CHAR)) LIKE ${`%${likeEscape(q.toLowerCase())}%`}`;
  return rows.map((r) => Number(r.id));
}

/**
 * The community feed: approved works, adviser opportunities and approved academic events only.
 * Every query filters on approval in SQL, so nothing private can slip into a page.
 */
feedRouter.get('/', async (req, res) => {
  const { type, dept, q, sort } = feedQuery.parse(req.query);
  const me = req.user!;
  const items: FeedItem[] = [];
  const now = Date.now();

  if (type === 'all' || type === 'saved' || (workTypes as readonly string[]).includes(type)) {
    const where: Prisma.WorkWhereInput = { ...publicWork };
    if ((workTypes as readonly string[]).includes(type)) where.type = type as WorkType;
    if (type === 'saved') where.saves = { some: { userId: me.id } };
    if (dept) where.author = { profile: { department: dept } };
    if (q) {
      where.OR = [
        { title: { contains: q } },
        { abstract: { contains: q } },
        { author: { name: { contains: q } } },
        { coAuthors: { some: { user: { name: { contains: q } } } } },
        { id: { in: await keywordMatches(q) } },
      ];
    }
    const works = await prisma.work.findMany({ where, include: workCardInclude(me.id), orderBy: { approvedAt: 'desc' }, take: 100 });
    for (const w of works) items.push({ kind: 'work', at: w.approvedAt!.toISOString(), work: toWorkCard(w) });
  }

  // Opportunities and events have no department; a department filter shows works only.
  if ((type === 'all' && !dept) || type === 'opportunities') {
    const opportunities = await prisma.opportunity.findMany({
      where: {
        deadline: { gte: new Date(now - DAY) },
        ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }, { adviser: { name: { contains: q } } }] } : {}),
      },
      include: opportunityInclude(me.id),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    for (const o of opportunities) items.push({ kind: 'opportunity', at: o.createdAt.toISOString(), opportunity: toOpportunityCard(o, me.id) });
  }

  if ((type === 'all' && !dept) || type === 'events') {
    const events = await prisma.event.findMany({
      where: {
        status: 'approved',
        date: { gte: new Date(now - DAY) },
        ...(q ? { OR: [{ title: { contains: q } }, { description: { contains: q } }, { venue: { contains: q } }] } : {}),
      },
      include: eventCardInclude(me.id),
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    for (const e of events) items.push({ kind: 'event', at: e.createdAt.toISOString(), event: toEventCard(e) });
  }

  const discussion = (i: FeedItem) => (i.kind === 'work' ? i.work.commentCount * 2 + i.work.reactionCount : -1);
  items.sort((a, b) => (sort === 'discussed' ? discussion(b) - discussion(a) : 0) || b.at.localeCompare(a.at));

  const [people, departments] = await Promise.all([
    q
      ? prisma.user.findMany({
          where: {
            OR: [
              { name: { contains: q } },
              { username: { contains: q } },
              { program: { contains: q } },
              { headline: { contains: q } },
              { profile: { department: { contains: q } } },
            ],
          },
          select: userCardSelect,
          orderBy: { name: 'asc' },
          take: 6,
        })
      : Promise.resolve([]),
    prisma.profile.findMany({
      where: { department: { not: '' }, user: { works: { some: publicWork } } },
      select: { department: true },
      distinct: ['department'],
      orderBy: { department: 'asc' },
    }),
  ]);

  const body: FeedResponse = { items, people: people.map(toUserCard), departments: departments.map((d) => d.department) };
  res.json(body);
});

/** Feed sidebar: approved academic ad slots running now, plus the next approved events. */
feedRouter.get('/sidebar', async (req, res) => {
  const now = new Date();
  const [ads, upcoming] = await Promise.all([
    prisma.ad.findMany({
      where: { status: 'approved', startsAt: { lte: now }, endsAt: { gte: now }, event: { status: 'approved', date: { gte: now } } },
      include: adInclude,
      orderBy: { startsAt: 'asc' },
      take: 3,
    }),
    prisma.event.findMany({
      where: { status: 'approved', date: { gte: now } },
      include: eventCardInclude(req.user!.id),
      orderBy: { date: 'asc' },
      take: 4,
    }),
  ]);
  const body: SidebarResponse = { ads: ads.map(toAdCard), upcoming: upcoming.map(toEventCard) };
  res.json(body);
});

// ---------- Opportunities ----------

/** Adviser opportunities:mentorships, research grants and calls for submissions. /api/opportunities/… */
export const opportunitiesRouter = Router();
opportunitiesRouter.use(requireAuth);

opportunitiesRouter.get('/mine', requireRole('educator', 'admin'), async (req, res) => {
  const me = req.user!;
  const rows = await prisma.opportunity.findMany({
    where: { adviserId: me.id },
    include: {
      ...opportunityInclude(me.id),
      applications: { orderBy: { createdAt: 'desc' }, include: { user: { select: userCardSelect } } },
    },
    orderBy: { createdAt: 'desc' },
  });
  const body: MyOpportunity[] = rows.map((o) => ({
    ...toOpportunityCard({ ...o, applications: [] }, me.id),
    applications: o.applications.map((a) => ({ user: toUserCard(a.user), message: a.message, createdAt: a.createdAt.toISOString() })),
  }));
  res.json(body);
});

opportunitiesRouter.post('/', requireRole('educator', 'admin'), requireVerified, async (req, res) => {
  const input = opportunitySchema.parse(req.body);
  const row = await prisma.opportunity.create({ data: { ...input, adviserId: req.user!.id } });
  res.status(201).json({ id: row.id });
});

opportunitiesRouter.delete('/:id', async (req, res) => {
  const me = req.user!;
  const { count } = await prisma.opportunity.deleteMany({
    where: { id: idParam.parse(req.params.id), ...(me.role === 'admin' ? {} : { adviserId: me.id }) },
  });
  res.status(count ? 204 : 404).end();
});

opportunitiesRouter.post('/:id/apply', requireRole('student', 'educator'), async (req, res) => {
  const { message } = applicationSchema.parse(req.body);
  const me = req.user!;
  const o = await prisma.opportunity.findUnique({ where: { id: idParam.parse(req.params.id) } });
  if (!o) {
    res.status(404).json({ error: 'That opportunity is no longer posted.' });
    return;
  }
  if (o.adviserId === me.id) {
    res.status(409).json({ error: 'You can’t apply to your own posting.' });
    return;
  }
  if (o.deadline.getTime() < Date.now() - DAY) {
    res.status(409).json({ error: 'Applications for this opportunity have closed.' });
    return;
  }
  const existing = await prisma.opportunityApplication.findUnique({ where: { opportunityId_userId: { opportunityId: o.id, userId: me.id } } });
  if (existing) {
    res.status(409).json({ error: 'You’ve already applied.' });
    return;
  }
  await prisma.opportunityApplication.create({ data: { opportunityId: o.id, userId: me.id, message } });
  await notify(o.adviserId, 'opportunity_application', `${me.name} applied to “${o.title}”.`, '/post');
  res.status(201).end();
});

opportunitiesRouter.delete('/:id/apply', async (req, res) => {
  await prisma.opportunityApplication.deleteMany({ where: { opportunityId: idParam.parse(req.params.id), userId: req.user!.id } });
  res.status(204).end();
});
