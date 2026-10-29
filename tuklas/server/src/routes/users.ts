/**
 * Users routes — portfolios, profile editing and people search.
 * Mounted at /api/users (public portfolio, photo, CV), /api/profile (own edits) and /api/people (pickers).
 */
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../db.js';
import { optionalAuth, requireAuth } from '../auth/middleware.js';
import { toPublicUser } from '../auth/session.js';
import { deleteUpload, rawBody, readUpload, saveUpload, sendUpload } from '../lib/files.js';
import { publicationCardInclude, toPublicationCard, toUserCard, toWorkCard, userCardSelect, workCardInclude } from '../lib/serialize.js';
import { libraryWhere } from '../policies/publications.js';
import { publicWork } from '../policies/works.js';
import { idParam } from '../schemas/common.js';
import { backgroundSchema, honorSchema, linksSchema, profileSchema, type Portfolio } from '../schemas/profile.js';
import { notifyAdmins } from '../lib/notify.js';

// ---------- Public portfolio ----------

/** Public portfolio pages:/api/users/:username/… */
export const usersRouter = Router();

usersRouter.get('/:username/portfolio', optionalAuth, async (req, res) => {
  const viewer = req.user;
  const user = await prisma.user.findUnique({
    where: { username: String(req.params.username) },
    include: {
      profile: true,
      links: { orderBy: { id: 'asc' } },
      background: { orderBy: [{ year: 'desc' }, { id: 'asc' }] },
      honors: { orderBy: [{ year: 'desc' }, { id: 'desc' }] },
    },
  });
  if (!user) {
    res.status(404).json({ error: 'There’s no portfolio at that address.' });
    return;
  }
  const isOwner = viewer?.id === user.id;
  const seeAll = isOwner || viewer?.role === 'admin';
  const include = workCardInclude(viewer?.id ?? 0);

  const [works, mentored, publications] = await Promise.all([
    prisma.work.findMany({
      where: { ...publicWork, OR: [{ authorId: user.id }, { coAuthors: { some: { userId: user.id } } }] },
      include,
      orderBy: { approvedAt: 'desc' },
    }),
    user.role === 'educator'
      ? prisma.work.findMany({ where: { ...publicWork, adviserId: user.id }, include, orderBy: { approvedAt: 'desc' } })
      : Promise.resolve([]),
    prisma.publication.findMany({
      where: { ...libraryWhere(viewer), OR: [{ authorId: user.id }, { coAuthors: { some: { userId: user.id } } }] },
      include: publicationCardInclude,
      orderBy: { publishedAt: 'desc' },
    }),
  ]);

  // Rule 4: honors stay private until an admin verifies them.
  const honors = user.honors.filter((h) => seeAll || h.verified);
  const body: Portfolio = {
    user: { ...toUserCard(user), headline: user.headline },
    titles: user.profile?.titles ?? '',
    bioLong: user.profile?.bioLong ?? '',
    cv: user.profile?.cvFile ? { url: `/api/users/${user.username}/cv`, name: user.profile.cvName ?? 'CV.pdf' } : null,
    links: user.links.map(({ id, type, url, label }) => ({ id, type, url, label })),
    background: user.background.map(({ id, degree, school, year }) => ({ id, degree, school, year })),
    honors: honors.map(({ id, kind, title, issuer, year, verified }) => ({ id, kind, title, issuer, year, verified })),
    works: works.map(toWorkCard),
    mentored: mentored.map(toWorkCard),
    publications: publications.map(toPublicationCard),
    stats: {
      published: works.length,
      mentored: mentored.length,
      publications: publications.length,
      verifiedHonors: user.honors.filter((h) => h.verified).length,
      degrees: user.background.length,
    },
    isOwner,
  };
  res.json(body);
});

usersRouter.get('/:username/photo', async (req, res) => {
  const profile = await prisma.profile.findFirst({ where: { user: { username: String(req.params.username) } } });
  if (!profile?.photoFile) {
    res.status(404).json({ error: 'No photo' });
    return;
  }
  sendUpload(res, profile.photoFile, { type: profile.photoType ?? 'image/jpeg' });
});

usersRouter.get('/:username/cv', async (req, res) => {
  const profile = await prisma.profile.findFirst({ where: { user: { username: String(req.params.username) } } });
  if (!profile?.cvFile) {
    res.status(404).json({ error: 'No CV uploaded' });
    return;
  }
  sendUpload(res, profile.cvFile, { type: 'application/pdf', name: profile.cvName ?? 'CV.pdf', download: req.query.download === '1' });
});

// ---------- Own profile ----------

/** The signed-in person's own portfolio: /api/profile/… Every write is scoped to req.user, so nobody can edit someone else's. */
export const profileRouter = Router();
profileRouter.use(requireAuth);

profileRouter.patch('/', async (req, res) => {
  const input = profileSchema.parse(req.body);
  const me = req.user!;
  const [user] = await prisma.$transaction([
    prisma.user.update({ where: { id: me.id }, data: { name: input.name, program: input.program, headline: input.headline } }),
    prisma.profile.upsert({
      where: { userId: me.id },
      create: { userId: me.id, titles: input.titles, department: input.department, bioLong: input.bioLong },
      update: { titles: input.titles, department: input.department, bioLong: input.bioLong },
    }),
  ]);
  res.json({ user: toPublicUser(user) });
});

profileRouter.put('/links', async (req, res) => {
  const { links } = linksSchema.parse(req.body);
  const me = req.user!;
  await prisma.$transaction([
    prisma.academicLink.deleteMany({ where: { userId: me.id } }),
    prisma.academicLink.createMany({ data: links.map((l) => ({ ...l, userId: me.id })) }),
  ]);
  res.status(204).end();
});

profileRouter.post('/background', async (req, res) => {
  const input = backgroundSchema.parse(req.body);
  const row = await prisma.background.create({ data: { ...input, userId: req.user!.id } });
  res.status(201).json(row);
});

profileRouter.put('/background/:id', async (req, res) => {
  const input = backgroundSchema.parse(req.body);
  const { count } = await prisma.background.updateMany({ where: { id: idParam.parse(req.params.id), userId: req.user!.id }, data: input });
  res.status(count ? 204 : 404).end();
});

profileRouter.delete('/background/:id', async (req, res) => {
  await prisma.background.deleteMany({ where: { id: idParam.parse(req.params.id), userId: req.user!.id } });
  res.status(204).end();
});

// Rule 4: a non-admin's honor is saved unverified, whatever the request says; editing it sends it back for verification.
profileRouter.post('/honors', async (req, res) => {
  const input = honorSchema.parse(req.body);
  const me = req.user!;
  const isAdmin = me.role === 'admin';
  const row = await prisma.honor.create({
    data: { ...input, userId: me.id, verified: isAdmin, verifiedById: isAdmin ? me.id : null, verifiedAt: isAdmin ? new Date() : null },
  });
  if (!isAdmin) await notifyAdmins('honor_claimed', `${me.name} added “${input.title}” and it needs verification.`, '/admin?tab=honors');
  res.status(201).json(row);
});

profileRouter.put('/honors/:id', async (req, res) => {
  const input = honorSchema.parse(req.body);
  const me = req.user!;
  const isAdmin = me.role === 'admin';
  const { count } = await prisma.honor.updateMany({
    where: { id: idParam.parse(req.params.id), userId: me.id },
    data: isAdmin ? input : { ...input, verified: false, verifiedById: null, verifiedAt: null },
  });
  res.status(count ? 204 : 404).end();
});

profileRouter.delete('/honors/:id', async (req, res) => {
  await prisma.honor.deleteMany({ where: { id: idParam.parse(req.params.id), userId: req.user!.id } });
  res.status(204).end();
});

profileRouter.put('/photo', rawBody, async (req, res) => {
  const upload = readUpload(req, 'image');
  const me = req.user!;
  const file = await saveUpload(upload);
  const old = await prisma.profile.findUnique({ where: { userId: me.id }, select: { photoFile: true } });
  await prisma.profile.upsert({
    where: { userId: me.id },
    create: { userId: me.id, photoFile: file, photoType: upload.type },
    update: { photoFile: file, photoType: upload.type },
  });
  await deleteUpload(old?.photoFile);
  res.status(204).end();
});

profileRouter.delete('/photo', async (req, res) => {
  const me = req.user!;
  const old = await prisma.profile.findUnique({ where: { userId: me.id }, select: { photoFile: true } });
  await prisma.profile.updateMany({ where: { userId: me.id }, data: { photoFile: null, photoType: null } });
  await deleteUpload(old?.photoFile);
  res.status(204).end();
});

profileRouter.put('/cv', rawBody, async (req, res) => {
  const upload = readUpload(req, 'pdf');
  const me = req.user!;
  const file = await saveUpload(upload);
  const old = await prisma.profile.findUnique({ where: { userId: me.id }, select: { cvFile: true } });
  await prisma.profile.upsert({
    where: { userId: me.id },
    create: { userId: me.id, cvFile: file, cvName: upload.name },
    update: { cvFile: file, cvName: upload.name },
  });
  await deleteUpload(old?.cvFile);
  res.status(204).end();
});

profileRouter.delete('/cv', async (req, res) => {
  const me = req.user!;
  const old = await prisma.profile.findUnique({ where: { userId: me.id }, select: { cvFile: true } });
  await prisma.profile.updateMany({ where: { userId: me.id }, data: { cvFile: null, cvName: null } });
  await deleteUpload(old?.cvFile);
  res.status(204).end();
});

// ---------- People ----------

/** Finding people: co-author and member pickers, the adviser list. /api/people/… */
export const peopleRouter = Router();
peopleRouter.use(requireAuth);

const searchQuery = z.object({
  q: z.string().trim().max(80).catch(''),
  role: z.enum(['student', 'educator', 'admin']).optional().catch(undefined),
});

peopleRouter.get('/search', async (req, res) => {
  const { q, role } = searchQuery.parse(req.query);
  if (q.length < 2) {
    res.json([]);
    return;
  }
  const users = await prisma.user.findMany({
    where: {
      role,
      OR: [
        { name: { contains: q } },
        { username: { contains: q } },
        { program: { contains: q } },
        { profile: { department: { contains: q } } },
      ],
    },
    select: userCardSelect,
    orderBy: { name: 'asc' },
    take: 10,
  });
  res.json(users.map(toUserCard));
});

/** Advisers a student can pick: verified educators only. */
peopleRouter.get('/advisers', async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { role: 'educator', verified: true },
    select: userCardSelect,
    orderBy: { name: 'asc' },
  });
  res.json(users.map(toUserCard));
});
