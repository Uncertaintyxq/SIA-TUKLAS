/**
 * Works routes — student research works at /api/works, from draft to the public library.
 * Groups: lists, one work, writing, submission and adviser review, defense tracker, and public reading.
 */
import { Router, type Response } from 'express';
import type { Prisma, User } from '@prisma/client';
import { prisma } from '../db.js';
import { optionalAuth, requireAuth, requireRole } from '../auth/middleware.js';
import { deleteUpload, rawBody, readUpload, saveUpload, sendUpload } from '../lib/files.js';
import { notify } from '../lib/notify.js';
import { tagsOf, toUserCard, toWorkCard, userCardSelect, workCardInclude } from '../lib/serialize.js';
import { overlap, terms } from '../lib/topics.js';
import { allowedDecisions, canEdit, canReview, canSeeWork, isAuthor, isPublic, publicWork, statusAfter } from '../policies/works.js';
import { idParam } from '../schemas/common.js';
import {
  commentSchema,
  createWorkSchema,
  decisionSchema,
  itemPatchSchema,
  reactionKinds,
  reactionSchema,
  similarQuery,
  stageSchema,
  submitSchema,
  workSchema,
  type MyWork,
  type SimilarWork,
  type WorkDetail,
  type WorkInput,
} from '../schemas/works.js';

export const worksRouter = Router();

const NOT_FOUND = 'That work doesn’t exist or isn’t public yet.';
const notFound = (res: Response) => res.status(404).json({ error: NOT_FOUND });

/** Loads just enough of a work to run the policies. */
const loadAccess = (id: number) =>
  prisma.work.findUnique({ where: { id }, include: { coAuthors: { select: { userId: true } } } });
type AccessWork = NonNullable<Awaited<ReturnType<typeof loadAccess>>>;

/** Authors, the adviser and admins: the people who see a work's versions, reviews and private thread. */
const isInsider = (w: AccessWork, u: User | undefined) =>
  Boolean(u && (isAuthor(w, u) || (w.status !== 'draft' && (w.adviserId === u.id || u.role === 'admin'))));

const authorIds = (w: AccessWork) => [w.authorId, ...w.coAuthors.map((c) => c.userId)];

// ---------- Lists ----------

export const myWorkInclude = (viewerId: number) =>
  ({
    ...workCardInclude(viewerId),
    _count: { select: { comments: { where: { scope: 'public' } }, reactions: true, versions: true } },
    reviews: {
      orderBy: { createdAt: 'desc' },
      include: { reviewer: { select: { name: true } }, revisionItems: { select: { confirmedByAdviser: true } } },
    },
  }) satisfies Prisma.WorkInclude;

type MyWorkRow = Prisma.WorkGetPayload<{ include: ReturnType<typeof myWorkInclude> }>;

export function toMyWork(w: MyWorkRow, viewerId: number): MyWork {
  const latest = w.reviews[0];
  return {
    ...toWorkCard(w),
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    submittedAt: w.submittedAt?.toISOString() ?? null,
    versionCount: w._count.versions,
    hasPdf: Boolean(w.pdfFile),
    isOwner: w.authorId === viewerId,
    openItems: w.reviews.flatMap((r) => r.revisionItems).filter((i) => !i.confirmedByAdviser).length,
    latestReview: latest
      ? { decision: latest.decision, comment: latest.comment, reviewerName: latest.reviewer.name, createdAt: latest.createdAt.toISOString() }
      : null,
  };
}

/** Everything I wrote or co-wrote, in every status. */
worksRouter.get('/mine', requireAuth, async (req, res) => {
  const me = req.user!;
  const works = await prisma.work.findMany({
    where: { OR: [{ authorId: me.id }, { coAuthors: { some: { userId: me.id } } }] },
    include: myWorkInclude(me.id),
    orderBy: { updatedAt: 'desc' },
  });
  res.json(works.map((w) => toMyWork(w, me.id)));
});

/** The adviser's review queue: everything submitted to me. Admins see all submitted work. */
worksRouter.get('/review-queue', requireAuth, requireRole('educator', 'admin'), async (req, res) => {
  const me = req.user!;
  const works = await prisma.work.findMany({
    where: me.role === 'admin' ? { status: { not: 'draft' } } : { adviserId: me.id, status: { not: 'draft' } },
    include: myWorkInclude(me.id),
    orderBy: { updatedAt: 'desc' },
    take: 200,
  });
  res.json(works.map((w) => toMyWork(w, me.id)));
});

/** Topic overlap check: approved works that share terms with a draft's title and keywords. */
worksRouter.get('/similar', requireAuth, async (req, res) => {
  const { title, keywords, exclude } = similarQuery.parse(req.query);
  const query = terms(`${title} ${keywords}`);
  if (query.length === 0) {
    res.json([]);
    return;
  }
  const works = await prisma.work.findMany({
    where: { ...publicWork, id: exclude ? { not: exclude } : undefined },
    select: {
      id: true,
      title: true,
      type: true,
      tags: true,
      abstract: true,
      approvedAt: true,
      author: { select: { name: true } },
      coAuthors: { orderBy: { order: 'asc' }, select: { user: { select: { name: true } } } },
    },
  });
  const ranked: (SimilarWork & { score: number })[] = works
    .map((w) => {
      const { score, shared } = overlap(query, { title: w.title, tags: tagsOf(w.tags), abstract: w.abstract });
      return {
        id: w.id,
        title: w.title,
        type: w.type,
        authors: [w.author.name, ...w.coAuthors.map((c) => c.user.name)],
        year: (w.approvedAt ?? new Date()).getFullYear(),
        shared,
        score,
      };
    })
    .filter((w) => w.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  res.json(ranked.map(({ score: _score, ...w }) => w));
});

// ---------- One work ----------

worksRouter.get('/:id', optionalAuth, async (req, res) => {
  const detail = await workDetail(idParam.parse(req.params.id), req.user);
  if (!detail) {
    notFound(res);
    return;
  }
  res.json(detail);
});

async function workDetail(id: number, viewer: User | undefined): Promise<WorkDetail | null> {
  const w = await prisma.work.findUnique({
    where: { id },
    include: {
      ...workCardInclude(viewer?.id ?? 0),
      versions: { orderBy: { version: 'desc' } },
      reviews: {
        orderBy: { createdAt: 'asc' },
        include: { reviewer: { select: userCardSelect }, revisionItems: { orderBy: { id: 'asc' } } },
      },
      comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: userCardSelect } } },
      defenseStages: { orderBy: [{ date: 'asc' }, { id: 'asc' }] },
    },
  });
  if (!w || !canSeeWork(w, viewer)) return null;

  const insider = isInsider(w, viewer);
  const open = isPublic(w);
  const finished = w.status === 'approved' || w.status === 'rejected';
  const reviewer = canReview(w, viewer);
  const counts = await prisma.reaction.groupBy({ by: ['kind'], where: { workId: w.id }, _count: { _all: true } });
  const items = w.reviews.flatMap((r) => r.revisionItems);
  const commentView = (c: (typeof w.comments)[number]) => ({
    id: c.id,
    author: toUserCard(c.author),
    text: c.text,
    createdAt: c.createdAt.toISOString(),
    canDelete: Boolean(viewer && (viewer.id === c.authorId || viewer.role === 'admin')),
  });

  return {
    ...toWorkCard(w),
    pdfName: w.pdfFile ? (w.pdfName ?? 'work.pdf') : null,
    submittedAt: w.submittedAt?.toISOString() ?? null,
    createdAt: w.createdAt.toISOString(),
    updatedAt: w.updatedAt.toISOString(),
    versions: insider
      ? w.versions.map((v) => ({ version: v.version, title: v.title, note: v.note, submittedAt: v.submittedAt.toISOString(), pdfName: v.pdfFile ? (v.pdfName ?? 'work.pdf') : null }))
      : [],
    reviews: insider
      ? w.reviews.map((r) => ({
          id: r.id,
          reviewer: toUserCard(r.reviewer),
          decision: r.decision,
          comment: r.comment,
          version: r.version,
          createdAt: r.createdAt.toISOString(),
          items: r.revisionItems.map((i) => ({ id: i.id, text: i.text, done: i.doneByStudent, confirmed: i.confirmedByAdviser })),
        }))
      : [],
    thread: insider ? w.comments.filter((c) => c.scope === 'review').map(commentView) : [],
    discussion: open ? w.comments.filter((c) => c.scope === 'public').map(commentView) : [],
    stages: w.defenseStages.map((s) => ({ id: s.id, stage: s.stage, date: s.date.toISOString(), panel: s.panel, verdict: s.verdict, notes: s.notes })),
    reactions: Object.fromEntries(reactionKinds.map((k) => [k, counts.find((c) => c.kind === k)?._count._all ?? 0])) as WorkDetail['reactions'],
    openItems: items.filter((i) => !i.confirmedByAdviser).length,
    can: {
      edit: canEdit(w, viewer),
      submit: canEdit(w, viewer),
      delete: Boolean(viewer && w.authorId === viewer.id && w.status === 'draft'),
      decide: reviewer && !w.removedAt ? allowedDecisions[w.status] : [],
      comment: insider && ['submitted', 'under_review', 'revision'].includes(w.status),
      manageStages: insider && !w.removedAt,
      tickItems: isAuthor(w, viewer) && !finished,
      confirmItems: reviewer && !finished,
      discuss: Boolean(viewer) && open,
    },
  };
}

// ---------- Writing a work ----------

/** The adviser must be a verified educator; co-authors are students or educators. Nobody plays two parts. */
async function checkPeople(input: Pick<WorkInput, 'adviserId' | 'coAuthorIds'>, me: User): Promise<string | null> {
  if (input.adviserId === me.id) return 'You can’t be your own adviser. Choose another research adviser.';
  const adviser = await prisma.user.findUnique({ where: { id: input.adviserId } });
  if (!adviser || adviser.role !== 'educator' || !adviser.verified) return 'Choose a verified research adviser.';
  const coAuthorIds = [...new Set(input.coAuthorIds ?? [])];
  if (coAuthorIds.includes(me.id)) return 'You’re already the main author; don’t add yourself as a co-author.';
  if (coAuthorIds.includes(input.adviserId)) return 'Your adviser can’t also be a co-author.';
  const found = await prisma.user.count({ where: { id: { in: coAuthorIds }, role: { in: ['student', 'educator'] } } });
  if (found !== coAuthorIds.length) return 'One of the co-authors couldn’t be found.';
  return null;
}

const coAuthorRows = (ids: number[] = []) => [...new Set(ids)].map((userId, i) => ({ userId, order: i + 1 }));

worksRouter.post('/', requireAuth, requireRole('student', 'educator'), async (req, res) => {
  const input = createWorkSchema.parse(req.body);
  const me = req.user!;
  const problem = await checkPeople(input, me);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  const work = await prisma.work.create({
    data: {
      authorId: me.id,
      adviserId: input.adviserId,
      type: input.type,
      title: input.title,
      abstract: input.abstract,
      tags: input.tags,
      status: 'draft',
      coAuthors: { create: coAuthorRows(input.coAuthorIds) },
    },
  });
  if (input.submit) await submitWork(work.id, me, '');
  res.status(201).json({ id: work.id });
});

worksRouter.put('/:id', requireAuth, async (req, res) => {
  const input = workSchema.parse(req.body);
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canSeeWork(w, me)) {
    notFound(res);
    return;
  }
  if (!canEdit(w, me)) {
    res.status(409).json({ error: 'Only the main author can edit a work, and only while it’s a draft or sent back for revision.' });
    return;
  }
  const problem = await checkPeople(input, me);
  if (problem) {
    res.status(400).json({ error: problem });
    return;
  }
  await prisma.$transaction([
    prisma.workAuthor.deleteMany({ where: { workId: w.id } }),
    prisma.work.update({
      where: { id: w.id },
      data: {
        type: input.type,
        title: input.title,
        abstract: input.abstract,
        tags: input.tags,
        adviserId: input.adviserId,
        coAuthors: { create: coAuthorRows(input.coAuthorIds) },
      },
    }),
  ]);
  res.status(204).end();
});

worksRouter.delete('/:id', requireAuth, async (req, res) => {
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canSeeWork(w, me)) {
    notFound(res);
    return;
  }
  if (w.authorId !== me.id || w.status !== 'draft') {
    res.status(409).json({ error: 'Only drafts can be deleted, by their main author.' });
    return;
  }
  await prisma.work.delete({ where: { id: w.id } });
  await deleteUpload(w.pdfFile);
  res.status(204).end();
});

/** Deletes a work's PDF unless a submitted version still points at it. */
async function releasePdf(file: string | null) {
  if (!file) return;
  const kept = await prisma.workVersion.count({ where: { pdfFile: file } });
  if (!kept) await deleteUpload(file);
}

worksRouter.put('/:id/pdf', requireAuth, rawBody, async (req, res) => {
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canSeeWork(w, me)) {
    notFound(res);
    return;
  }
  if (!canEdit(w, me)) {
    res.status(409).json({ error: 'The PDF can only change while the work is a draft or sent back for revision.' });
    return;
  }
  const upload = readUpload(req, 'pdf');
  const file = await saveUpload(upload);
  await prisma.work.update({ where: { id: w.id }, data: { pdfFile: file, pdfName: upload.name } });
  await releasePdf(w.pdfFile);
  res.status(204).end();
});

worksRouter.delete('/:id/pdf', requireAuth, async (req, res) => {
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canEdit(w, me)) {
    notFound(res);
    return;
  }
  await prisma.work.update({ where: { id: w.id }, data: { pdfFile: null, pdfName: null } });
  await releasePdf(w.pdfFile);
  res.status(204).end();
});

worksRouter.get('/:id/pdf', optionalAuth, async (req, res) => {
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canSeeWork(w, req.user) || !w.pdfFile) {
    notFound(res);
    return;
  }
  sendUpload(res, w.pdfFile, { type: 'application/pdf', name: w.pdfName ?? 'work.pdf', download: req.query.download === '1' });
});

worksRouter.get('/:id/versions/:version/pdf', requireAuth, async (req, res) => {
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !isInsider(w, req.user)) {
    notFound(res);
    return;
  }
  const v = await prisma.workVersion.findUnique({ where: { workId_version: { workId: w.id, version: idParam.parse(req.params.version) } } });
  if (!v?.pdfFile) {
    notFound(res);
    return;
  }
  sendUpload(res, v.pdfFile, { type: 'application/pdf', name: v.pdfName ?? `version-${v.version}.pdf` });
});

// ---------- Submission and review ----------

/** Snapshots the work as a new version, sends it to the adviser, and tells them. */
async function submitWork(id: number, me: User, note: string) {
  const w = (await loadAccess(id))!;
  const last = await prisma.workVersion.findFirst({ where: { workId: id }, orderBy: { version: 'desc' }, select: { version: true } });
  const version = (last?.version ?? 0) + 1;
  await prisma.$transaction([
    prisma.workVersion.create({
      data: { workId: id, version, title: w.title, abstract: w.abstract, tags: w.tags as Prisma.InputJsonValue, pdfFile: w.pdfFile, pdfName: w.pdfName, note },
    }),
    prisma.work.update({ where: { id }, data: { status: 'submitted', submittedAt: new Date() } }),
  ]);
  const resubmitted = version > 1;
  await notify(
    [w.adviserId, ...authorIds(w)],
    resubmitted ? 'work_resubmitted' : 'work_submitted',
    resubmitted
      ? `${me.name} resubmitted “${w.title}” (version ${version}).`
      : `${me.name} submitted “${w.title}” for review.`,
    `/works/${id}`,
    me.id,
  );
}

worksRouter.post('/:id/submit', requireAuth, async (req, res) => {
  const { note } = submitSchema.parse(req.body ?? {});
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canSeeWork(w, me)) {
    notFound(res);
    return;
  }
  if (!canEdit(w, me)) {
    res.status(409).json({ error: 'Only the main author can submit, and only a draft or a work sent back for revision.' });
    return;
  }
  await submitWork(w.id, me, note);
  res.status(204).end();
});

const decisionNotice = {
  start_review: { type: 'work_under_review', text: (who: string, title: string) => `${who} started reviewing “${title}”.` },
  revise: { type: 'work_revision', text: (who: string, title: string) => `${who} returned “${title}” with comments. Revise and resubmit.` },
  approve: { type: 'work_approved', text: (who: string, title: string) => `“${title}” was approved by ${who}. It’s now public.` },
  reject: { type: 'work_rejected', text: (who: string, title: string) => `${who} marked “${title}” as not approved.` },
} as const;

worksRouter.post('/:id/decision', requireAuth, async (req, res) => {
  const { decision, comment, items } = decisionSchema.parse(req.body);
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canSeeWork(w, me)) {
    notFound(res);
    return;
  }
  if (!canReview(w, me)) {
    res.status(403).json({
      error:
        me.role === 'educator' && !me.verified
          ? 'An admin needs to verify your educator account before you can review work.'
          : 'Only the assigned adviser or an admin can decide on this work, and never on their own.',
    });
    return;
  }
  if (!allowedDecisions[w.status].includes(decision) || w.removedAt) {
    res.status(409).json({ error: `A work that is ${w.status.replace('_', ' ')} can’t be changed that way.` });
    return;
  }
  if (decision === 'revise' && !comment && items.length === 0) {
    res.status(400).json({ error: 'Tell the author what to revise: add a comment or checklist items.' });
    return;
  }
  if (decision === 'approve') {
    const open = await prisma.revisionItem.count({ where: { review: { workId: w.id }, confirmedByAdviser: false } });
    if (open) {
      res.status(409).json({ error: `Confirm the ${open} open revision checklist item${open > 1 ? 's' : ''} before approving.` });
      return;
    }
  }

  const last = await prisma.workVersion.findFirst({ where: { workId: w.id }, orderBy: { version: 'desc' }, select: { version: true } });
  const approving = decision === 'approve';
  const now = new Date();
  await prisma.$transaction([
    prisma.review.create({
      data: {
        workId: w.id,
        reviewerId: me.id,
        decision,
        comment: comment || null,
        version: last?.version ?? 1,
        revisionItems: { create: decision === 'revise' ? items.map((text) => ({ text })) : [] },
      },
    }),
    prisma.work.update({
      where: { id: w.id },
      data: {
        status: statusAfter[decision],
        ...(approving ? { approvedAt: now, approvedById: me.id } : {}),
      },
    }),
    // Approval is the journey's last stop: "published" joins the defense tracker.
    ...(approving
      ? [prisma.defenseStage.create({ data: { workId: w.id, stage: 'published', date: now, verdict: 'passed', panel: me.name, notes: 'Approved and published on Tuklas.' } })]
      : []),
  ]);

  const notice = decisionNotice[decision];
  await notify(authorIds(w), notice.type, notice.text(me.name, w.title), `/works/${w.id}`, me.id);
  res.status(204).end();
});

/** The private review thread between the authors and the adviser. */
worksRouter.post('/:id/comments', requireAuth, async (req, res) => {
  const { text } = commentSchema.parse(req.body);
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  if (!w || !canSeeWork(w, me) || !isInsider(w, me)) {
    notFound(res);
    return;
  }
  if (!['submitted', 'under_review', 'revision'].includes(w.status)) {
    res.status(409).json({ error: 'The review thread is closed for this work.' });
    return;
  }
  await prisma.comment.create({ data: { workId: w.id, authorId: me.id, text, scope: 'review' } });
  const to = isAuthor(w, me) ? [w.adviserId, ...authorIds(w)] : authorIds(w);
  await notify(to, 'work_comment', `${me.name} commented on “${w.title}”.`, `/works/${w.id}`, me.id);
  res.status(201).end();
});

/** Revision checklist: authors tick their fixes; the reviewer confirms each one. */
worksRouter.patch('/:id/items/:itemId', requireAuth, async (req, res) => {
  const patch = itemPatchSchema.parse(req.body);
  const me = req.user!;
  const w = await loadAccess(idParam.parse(req.params.id));
  const item = await prisma.revisionItem.findFirst({ where: { id: idParam.parse(req.params.itemId), review: { workId: w?.id ?? 0 } } });
  if (!w || !item || !canSeeWork(w, me)) {
    notFound(res);
    return;
  }
  if (w.status === 'approved' || w.status === 'rejected') {
    res.status(409).json({ error: 'This work is final; its checklist can’t change.' });
    return;
  }
  const data: Prisma.RevisionItemUpdateInput = {};
  if (patch.done !== undefined) {
    if (!isAuthor(w, me)) {
      res.status(403).json({ error: 'Only the authors tick off their fixes.' });
      return;
    }
    if (item.confirmedByAdviser) {
      res.status(409).json({ error: 'Your adviser already confirmed this fix.' });
      return;
    }
    data.doneByStudent = patch.done;
  }
  if (patch.confirmed !== undefined) {
    if (!canReview(w, me)) {
      res.status(403).json({ error: 'Only the reviewer confirms fixes.' });
      return;
    }
    if (patch.confirmed && !(data.doneByStudent ?? item.doneByStudent)) {
      res.status(409).json({ error: 'The author hasn’t marked this fix as done yet.' });
      return;
    }
    data.confirmedByAdviser = patch.confirmed;
  }
  await prisma.revisionItem.update({ where: { id: item.id }, data });
  res.status(204).end();
});

// ---------- Defense tracker ----------

async function stageAccess(id: number, me: User) {
  const w = await loadAccess(id);
  return w && isInsider(w, me) && !w.removedAt ? w : null;
}

worksRouter.post('/:id/stages', requireAuth, async (req, res) => {
  const input = stageSchema.parse(req.body);
  const w = await stageAccess(idParam.parse(req.params.id), req.user!);
  if (!w) {
    notFound(res);
    return;
  }
  await prisma.defenseStage.create({ data: { ...input, workId: w.id } });
  res.status(201).end();
});

worksRouter.put('/:id/stages/:stageId', requireAuth, async (req, res) => {
  const input = stageSchema.parse(req.body);
  const w = await stageAccess(idParam.parse(req.params.id), req.user!);
  const { count } = w
    ? await prisma.defenseStage.updateMany({ where: { id: idParam.parse(req.params.stageId), workId: w.id }, data: input })
    : { count: 0 };
  res.status(count ? 204 : 404).end();
});

worksRouter.delete('/:id/stages/:stageId', requireAuth, async (req, res) => {
  const w = await stageAccess(idParam.parse(req.params.id), req.user!);
  if (w) await prisma.defenseStage.deleteMany({ where: { id: idParam.parse(req.params.stageId), workId: w.id } });
  res.status(w ? 204 : 404).end();
});

// ---------- Public reading: reactions, library, discussion ----------

/** Loads a work only if it's public; reactions and discussion exist only there. */
async function loadPublic(id: number) {
  const w = await loadAccess(id);
  return w && isPublic(w) ? w : null;
}

worksRouter.put('/:id/reaction', requireAuth, async (req, res) => {
  const { kind } = reactionSchema.parse(req.body);
  const me = req.user!;
  const w = await loadPublic(idParam.parse(req.params.id));
  if (!w) {
    notFound(res);
    return;
  }
  await prisma.reaction.upsert({
    where: { userId_workId: { userId: me.id, workId: w.id } },
    create: { userId: me.id, workId: w.id, kind },
    update: { kind },
  });
  res.status(204).end();
});

worksRouter.delete('/:id/reaction', requireAuth, async (req, res) => {
  await prisma.reaction.deleteMany({ where: { userId: req.user!.id, workId: idParam.parse(req.params.id) } });
  res.status(204).end();
});

worksRouter.put('/:id/save', requireAuth, async (req, res) => {
  const me = req.user!;
  const w = await loadPublic(idParam.parse(req.params.id));
  if (!w) {
    notFound(res);
    return;
  }
  await prisma.savedWork.upsert({
    where: { userId_workId: { userId: me.id, workId: w.id } },
    create: { userId: me.id, workId: w.id },
    update: {},
  });
  res.status(204).end();
});

worksRouter.delete('/:id/save', requireAuth, async (req, res) => {
  await prisma.savedWork.deleteMany({ where: { userId: req.user!.id, workId: idParam.parse(req.params.id) } });
  res.status(204).end();
});

worksRouter.post('/:id/discussion', requireAuth, async (req, res) => {
  const { text } = commentSchema.parse(req.body);
  const me = req.user!;
  const w = await loadPublic(idParam.parse(req.params.id));
  if (!w) {
    notFound(res);
    return;
  }
  await prisma.comment.create({ data: { workId: w.id, authorId: me.id, text, scope: 'public' } });
  await notify(authorIds(w), 'work_comment', `${me.name} commented on your published work “${w.title}”.`, `/works/${w.id}#discussion`, me.id);
  res.status(201).end();
});

worksRouter.delete('/:id/discussion/:commentId', requireAuth, async (req, res) => {
  const me = req.user!;
  const { count } = await prisma.comment.deleteMany({
    where: {
      id: idParam.parse(req.params.commentId),
      workId: idParam.parse(req.params.id),
      scope: 'public',
      ...(me.role === 'admin' ? {} : { authorId: me.id }),
    },
  });
  res.status(count ? 204 : 404).end();
});
