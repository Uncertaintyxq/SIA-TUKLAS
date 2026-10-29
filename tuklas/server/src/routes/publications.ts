/**
 * Publications routes — the research library and educator publishing at /api/publications.
 * Groups: reading (library list, detail, PDF) and writing (draft, edit, publish, delete).
 */
import { Router, type Response } from 'express';
import type { User } from '@prisma/client';
import { prisma } from '../db.js';
import { optionalAuth, requireAuth, requireRole } from '../auth/middleware.js';
import { deleteUpload, rawBody, readUpload, saveUpload, sendUpload } from '../lib/files.js';
import { publicationCardInclude, toPublicationCard } from '../lib/serialize.js';
import { canSeePublication, libraryWhere } from '../policies/publications.js';
import { hasRight } from '../policies/rights.js';
import { idParam } from '../schemas/common.js';
import { publicationSchema, publicationsQuery, type PublicationDetail, type PublicationInput } from '../schemas/publications.js';

/**
 * Educator research publishing: educators draft, host and publish their own research (no adviser review),
 * and everyone reads it in the research library. /api/publications/…
 */
export const publicationsRouter = Router();

const notFound = (res: Response) => res.status(404).json({ error: 'That research doesn’t exist or isn’t published.' });

const load = (id: number) => prisma.publication.findUnique({ where: { id }, include: publicationCardInclude });

// ---------- Reading ----------

/** The research library: published work the viewer may read, newest first. ?q= searches titles, abstracts, keywords and authors. */
publicationsRouter.get('/', optionalAuth, async (req, res) => {
  const { q } = publicationsQuery.parse(req.query);
  const rows = await prisma.publication.findMany({ where: libraryWhere(req.user), include: publicationCardInclude, orderBy: { publishedAt: 'desc' }, take: 200 });
  const term = q.toLowerCase();
  const cards = rows
    .map(toPublicationCard)
    .filter((p) => !term || [p.title, p.abstract, ...p.keywords, ...p.authors.map((a) => a.name)].some((s) => s.toLowerCase().includes(term)));
  res.json(cards);
});

/** Everything I wrote or co-wrote, drafts included. */
publicationsRouter.get('/mine', requireAuth, async (req, res) => {
  const me = req.user!;
  const rows = await prisma.publication.findMany({
    where: { OR: [{ authorId: me.id }, { coAuthors: { some: { userId: me.id } } }] },
    include: publicationCardInclude,
    orderBy: { updatedAt: 'desc' },
  });
  res.json(rows.map(toPublicationCard));
});

publicationsRouter.get('/:id', optionalAuth, async (req, res) => {
  const viewer = req.user;
  const p = await load(idParam.parse(req.params.id));
  if (!p || !canSeePublication(p, viewer)) {
    notFound(res);
    return;
  }
  const body: PublicationDetail = {
    ...toPublicationCard(p),
    methodology: p.methodology,
    fullText: p.fullText,
    pdfName: p.pdfFile ? (p.pdfName ?? 'research.pdf') : null,
    can: {
      edit: viewer?.id === p.authorId,
      delete: Boolean(viewer && (viewer.id === p.authorId || viewer.role === 'admin')),
      publish: viewer?.id === p.authorId && hasRight(viewer, 'publish'),
    },
  };
  res.json(body);
});

publicationsRouter.get('/:id/pdf', optionalAuth, async (req, res) => {
  const p = await load(idParam.parse(req.params.id));
  if (!p || !p.pdfFile || !canSeePublication(p, req.user)) {
    notFound(res);
    return;
  }
  sendUpload(res, p.pdfFile, { type: 'application/pdf', name: p.pdfName ?? 'research.pdf', download: req.query.download === '1' });
});

// ---------- Writing ----------

/** Verified educators write; Internal and Public need the publishing right. Returns the problem to show, or null. */
async function checkInput(input: Pick<PublicationInput, 'visibility' | 'coAuthorIds'>, me: User): Promise<{ status: 400 | 403; error: string } | null> {
  if (!me.verified) return { status: 403, error: 'An admin needs to verify your educator account first.' };
  if (input.visibility !== 'draft' && !hasRight(me, 'publish'))
    return { status: 403, error: 'An admin has turned off your publishing right. You can still save drafts.' };
  const ids = [...new Set(input.coAuthorIds ?? [])];
  if (ids.includes(me.id)) return { status: 400, error: 'You’re already the main author; don’t add yourself as a co-author.' };
  const found = await prisma.user.count({ where: { id: { in: ids }, role: { in: ['student', 'educator'] } } });
  return found === ids.length ? null : { status: 400, error: 'One of the co-authors couldn’t be found.' };
}

const coAuthorRows = (ids: number[] = []) => [...new Set(ids)].map((userId, i) => ({ userId, order: i + 1 }));

publicationsRouter.post('/', requireAuth, requireRole('educator'), async (req, res) => {
  const input = publicationSchema.parse(req.body);
  const me = req.user!;
  const problem = await checkInput(input, me);
  if (problem) {
    res.status(problem.status).json({ error: problem.error });
    return;
  }
  const { coAuthorIds, ...fields } = input;
  const p = await prisma.publication.create({
    data: { ...fields, authorId: me.id, publishedAt: input.visibility === 'draft' ? null : new Date(), coAuthors: { create: coAuthorRows(coAuthorIds) } },
  });
  res.status(201).json({ id: p.id });
});

/** Only the main author edits. The first move out of Draft stamps the publication date. */
publicationsRouter.put('/:id', requireAuth, async (req, res) => {
  const input = publicationSchema.parse(req.body);
  const me = req.user!;
  const p = await load(idParam.parse(req.params.id));
  if (!p || !canSeePublication(p, me)) {
    notFound(res);
    return;
  }
  if (p.authorId !== me.id) {
    res.status(403).json({ error: 'Only the main author can edit this research.' });
    return;
  }
  const problem = await checkInput(input, me);
  if (problem) {
    res.status(problem.status).json({ error: problem.error });
    return;
  }
  const { coAuthorIds, ...fields } = input;
  await prisma.$transaction([
    prisma.publicationAuthor.deleteMany({ where: { publicationId: p.id } }),
    prisma.publication.update({
      where: { id: p.id },
      data: {
        ...fields,
        publishedAt: input.visibility === 'draft' ? p.publishedAt : (p.publishedAt ?? new Date()),
        coAuthors: { create: coAuthorRows(coAuthorIds) },
      },
    }),
  ]);
  res.status(204).end();
});

/** The main author removes their research; an admin can take it down. */
publicationsRouter.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user!;
  const p = await load(idParam.parse(req.params.id));
  if (!p || !canSeePublication(p, me) || !(p.authorId === me.id || me.role === 'admin')) {
    notFound(res);
    return;
  }
  await prisma.publication.delete({ where: { id: p.id } });
  await deleteUpload(p.pdfFile);
  res.status(204).end();
});

publicationsRouter.put('/:id/pdf', requireAuth, rawBody, async (req, res) => {
  const me = req.user!;
  const p = await load(idParam.parse(req.params.id));
  if (!p || p.authorId !== me.id) {
    notFound(res);
    return;
  }
  const upload = readUpload(req, 'pdf');
  const file = await saveUpload(upload);
  await prisma.publication.update({ where: { id: p.id }, data: { pdfFile: file, pdfName: upload.name } });
  await deleteUpload(p.pdfFile);
  res.status(204).end();
});

publicationsRouter.delete('/:id/pdf', requireAuth, async (req, res) => {
  const me = req.user!;
  const p = await load(idParam.parse(req.params.id));
  if (!p || p.authorId !== me.id) {
    notFound(res);
    return;
  }
  await prisma.publication.update({ where: { id: p.id }, data: { pdfFile: null, pdfName: null } });
  await deleteUpload(p.pdfFile);
  res.status(204).end();
});
