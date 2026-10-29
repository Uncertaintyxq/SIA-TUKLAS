/**
 * Events routes — events at /api/events and their academic ad slots at /api/ads.
 * Groups: browsing, organizing (admin approval for educators), registration, and ads.
 */
import { Router, type Response } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { optionalAuth, requireAuth, requireRole, requireVerified } from '../auth/middleware.js';
import { deleteUpload, rawBody, readUpload, saveUpload, sendUpload } from '../lib/files.js';
import { notify, notifyAdmins } from '../lib/notify.js';
import { adInclude, eventCardInclude, toAdCard, toEventCard, toUserCard, userCardSelect } from '../lib/serialize.js';
import { idParam } from '../schemas/common.js';
import { adSchema, eventSchema, type EventDetail, type EventsResponse } from '../schemas/events.js';

export const eventsRouter = Router();
eventsRouter.use(requireAuth);

const notFound = (res: Response) => res.status(404).json({ error: 'That event doesn’t exist or isn’t approved yet.' });
const canManage = (e: { postedById: number }, u: User) => u.role === 'admin' || e.postedById === u.id;

// ---------- Browsing ----------

eventsRouter.get('/', async (req, res) => {
  const me = req.user!;
  const now = new Date();
  const include = eventCardInclude(me.id);
  const organizes = me.role !== 'student';
  const [upcoming, past, mine, myAds] = await Promise.all([
    prisma.event.findMany({ where: { status: 'approved', date: { gte: now } }, include, orderBy: { date: 'asc' } }),
    prisma.event.findMany({ where: { status: 'approved', date: { lt: now } }, include, orderBy: { date: 'desc' }, take: 12 }),
    organizes ? prisma.event.findMany({ where: { postedById: me.id }, include, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
    organizes ? prisma.ad.findMany({ where: { createdById: me.id }, include: adInclude, orderBy: { createdAt: 'desc' } }) : Promise.resolve([]),
  ]);
  const body: EventsResponse = {
    upcoming: upcoming.map(toEventCard),
    past: past.map(toEventCard),
    mine: mine.map(toEventCard),
    myAds: myAds.map(toAdCard),
  };
  res.json(body);
});

eventsRouter.get('/:id', async (req, res) => {
  const me = req.user!;
  const e = await prisma.event.findUnique({
    where: { id: idParam.parse(req.params.id) },
    include: {
      ...eventCardInclude(me.id),
      ads: { include: adInclude, orderBy: { createdAt: 'desc' } },
    },
  });
  // Pending and rejected events are visible only to their organizer and admins.
  if (!e || (e.status !== 'approved' && !canManage(e, me))) {
    notFound(res);
    return;
  }
  const manage = canManage(e, me);
  const attendees = manage
    ? await prisma.eventRegistration.findMany({
        where: { eventId: e.id },
        include: { user: { select: userCardSelect } },
        orderBy: { createdAt: 'asc' },
      })
    : null;
  const upcoming = e.date.getTime() >= Date.now();
  const full = e.capacity !== null && e._count.registrations >= e.capacity;
  const body: EventDetail = {
    ...toEventCard(e),
    isOrganizer: e.postedById === me.id,
    canRegister: e.status === 'approved' && upcoming && !full,
    canPromote: manage && e.status === 'approved' && upcoming,
    attendees: attendees?.map((a) => ({ user: toUserCard(a.user), registeredAt: a.createdAt.toISOString() })) ?? null,
    ads: manage ? e.ads.map(toAdCard) : [],
  };
  res.json(body);
});

// ---------- Organizing ----------

/** Educators propose events for admin approval; an admin's event is approved straight away. */
eventsRouter.post('/', requireRole('educator', 'admin'), requireVerified, async (req, res) => {
  const input = eventSchema.parse(req.body);
  const me = req.user!;
  const isAdmin = me.role === 'admin';
  const e = await prisma.event.create({ data: { ...input, postedById: me.id, status: isAdmin ? 'approved' : 'pending' } });
  if (!isAdmin) await notifyAdmins('event_proposed', `${me.name} proposed “${e.title}” and it needs approval.`, '/admin?tab=events');
  res.status(201).json({ id: e.id, status: e.status });
});

eventsRouter.delete('/:id', async (req, res) => {
  const me = req.user!;
  const e = await prisma.event.findUnique({
    where: { id: idParam.parse(req.params.id) },
    include: { registrations: { select: { userId: true } }, ads: { select: { imageFile: true } } },
  });
  if (!e || !canManage(e, me)) {
    notFound(res);
    return;
  }
  await prisma.event.delete({ where: { id: e.id } });
  await Promise.all(e.ads.map((a) => deleteUpload(a.imageFile)));
  if (e.status === 'approved' && e.date.getTime() > Date.now()) {
    await notify(e.registrations.map((r) => r.userId), 'event_cancelled', `“${e.title}” was cancelled.`, '/events', me.id);
  }
  res.status(204).end();
});

// ---------- Registration ----------

eventsRouter.post('/:id/register', async (req, res) => {
  const me = req.user!;
  const e = await prisma.event.findUnique({ where: { id: idParam.parse(req.params.id) }, include: { _count: { select: { registrations: true } } } });
  if (!e || e.status !== 'approved') {
    notFound(res);
    return;
  }
  if (e.date.getTime() < Date.now()) {
    res.status(409).json({ error: 'This event has already happened.' });
    return;
  }
  const existing = await prisma.eventRegistration.findUnique({ where: { eventId_userId: { eventId: e.id, userId: me.id } } });
  if (existing) {
    res.status(204).end();
    return;
  }
  if (e.capacity !== null && e._count.registrations >= e.capacity) {
    res.status(409).json({ error: 'This event is full.' });
    return;
  }
  await prisma.eventRegistration.create({ data: { eventId: e.id, userId: me.id } });
  res.status(201).end();
});

eventsRouter.delete('/:id/register', async (req, res) => {
  await prisma.eventRegistration.deleteMany({ where: { eventId: idParam.parse(req.params.id), userId: req.user!.id } });
  res.status(204).end();
});

// ---------- Ads ----------

/**
 * Academic ad slots: only for an approved, upcoming event, requested by its organizer or an admin.
 * A non-admin's request is always saved as pending.
 */
eventsRouter.post('/:id/ads', async (req, res) => {
  const input = adSchema.parse(req.body);
  const me = req.user!;
  const e = await prisma.event.findUnique({ where: { id: idParam.parse(req.params.id) } });
  if (!e || !canManage(e, me)) {
    notFound(res);
    return;
  }
  if (e.status !== 'approved' || e.date.getTime() < Date.now()) {
    res.status(409).json({ error: 'Only approved, upcoming events can be promoted.' });
    return;
  }
  const isAdmin = me.role === 'admin';
  const ad = await prisma.ad.create({
    data: { ...input, endsAt: input.endsAt > e.date ? e.date : input.endsAt, eventId: e.id, createdById: me.id, status: isAdmin ? 'approved' : 'pending' },
  });
  if (!isAdmin) await notifyAdmins('ad_requested', `${me.name} requested an ad slot for “${e.title}”.`, '/admin?tab=ads');
  res.status(201).json({ id: ad.id, status: ad.status });
});

export const adsRouter = Router();

/** Approved ads are public to anyone signed in; pending ones only to their requester and admins. */
adsRouter.get('/:id/image', optionalAuth, async (req, res) => {
  const ad = await prisma.ad.findUnique({ where: { id: idParam.parse(req.params.id) } });
  const me = req.user;
  if (!ad?.imageFile || (ad.status !== 'approved' && !(me && (me.role === 'admin' || me.id === ad.createdById)))) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  sendUpload(res, ad.imageFile, { type: ad.imageType ?? 'image/jpeg' });
});

adsRouter.put('/:id/image', requireAuth, rawBody, async (req, res) => {
  const me = req.user!;
  const ad = await prisma.ad.findUnique({ where: { id: idParam.parse(req.params.id) }, include: { event: { select: { title: true } } } });
  if (!ad || !(me.role === 'admin' || me.id === ad.createdById)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const upload = readUpload(req, 'image');
  const file = await saveUpload(upload);
  const isAdmin = me.role === 'admin';
  // A new image on an approved ad goes back to an admin.
  await prisma.ad.update({ where: { id: ad.id }, data: { imageFile: file, imageType: upload.type, ...(isAdmin ? {} : { status: 'pending' }) } });
  await deleteUpload(ad.imageFile);
  if (!isAdmin && ad.status === 'approved') {
    await notifyAdmins('ad_requested', `${me.name} changed the image on the ad for “${ad.event.title}”.`, '/admin?tab=ads');
  }
  res.status(204).end();
});

adsRouter.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user!;
  const ad = await prisma.ad.findUnique({ where: { id: idParam.parse(req.params.id) } });
  if (!ad || !(me.role === 'admin' || me.id === ad.createdById)) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  await prisma.ad.delete({ where: { id: ad.id } });
  await deleteUpload(ad.imageFile);
  res.status(204).end();
});
