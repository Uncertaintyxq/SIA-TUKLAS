/**
 * Serialize — Prisma selects and mappers that turn database rows into the card shapes the client renders.
 * Covers users, works, events, ads, opportunities and publications; each include pairs with its to*Card function.
 */
import type { Prisma } from '@prisma/client';
import type { UserCard } from '../schemas/common.js';
import type { AdCard, EventCard } from '../schemas/events.js';
import type { OpportunityCard } from '../schemas/feed.js';
import type { PublicationCard } from '../schemas/publications.js';
import type { ReactionKind, WorkCard } from '../schemas/works.js';

// ---------- Users ----------

export const userCardSelect = {
  id: true,
  name: true,
  username: true,
  role: true,
  verified: true,
  program: true,
  profile: { select: { department: true, photoFile: true, updatedAt: true } },
} satisfies Prisma.UserSelect;

type CardUser = Prisma.UserGetPayload<{ select: typeof userCardSelect }>;

export function toUserCard(u: CardUser): UserCard {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    verified: u.verified,
    program: u.program,
    department: u.profile?.department ?? '',
    // The version query busts the browser cache when the photo changes.
    photoUrl: u.profile?.photoFile ? `/api/users/${u.username}/photo?v=${u.profile.updatedAt.getTime()}` : null,
  };
}

// ---------- Works ----------

/** Everything a work card needs, plus the viewer's own reaction and save (viewer 0 = logged out). */
export const workCardInclude = (viewerId: number) =>
  ({
    author: { select: userCardSelect },
    adviser: { select: userCardSelect },
    approvedBy: { select: { name: true, role: true } },
    coAuthors: { orderBy: { order: 'asc' }, include: { user: { select: userCardSelect } } },
    reactions: { where: { userId: viewerId }, select: { kind: true } },
    saves: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { comments: { where: { scope: 'public' } }, reactions: true } },
  }) satisfies Prisma.WorkInclude;

export type CardWork = Prisma.WorkGetPayload<{ include: ReturnType<typeof workCardInclude> }>;

export const tagsOf = (tags: Prisma.JsonValue): string[] => (Array.isArray(tags) ? tags.filter((t): t is string => typeof t === 'string') : []);

export function toWorkCard(w: CardWork): WorkCard {
  const isPublic = w.status === 'approved' && !w.removedAt;
  return {
    id: w.id,
    type: w.type,
    title: w.title,
    abstract: w.abstract,
    tags: tagsOf(w.tags),
    status: w.status,
    authors: [toUserCard(w.author), ...w.coAuthors.map((c) => toUserCard(c.user))],
    adviser: toUserCard(w.adviser),
    department: w.author.profile?.department ?? '',
    approvedAt: w.approvedAt?.toISOString() ?? null,
    approval:
      w.status === 'approved' && w.approvedAt
        ? { approvedAt: w.approvedAt.toISOString(), approverName: w.approvedBy?.name ?? 'Academic panel', approverRole: w.approvedBy?.role ?? 'admin' }
        : null,
    removed: Boolean(w.removedAt),
    commentCount: isPublic ? w._count.comments : 0,
    reactionCount: isPublic ? w._count.reactions : 0,
    myReaction: (w.reactions[0]?.kind as ReactionKind | undefined) ?? null,
    saved: w.saves.length > 0,
  };
}

// ---------- Events and ads ----------

export const eventCardInclude =(viewerId: number) =>
  ({
    postedBy: { select: userCardSelect },
    registrations: { where: { userId: viewerId }, select: { userId: true } },
    _count: { select: { registrations: true } },
  }) satisfies Prisma.EventInclude;

export type CardEvent = Prisma.EventGetPayload<{ include: ReturnType<typeof eventCardInclude> }>;

export function toEventCard(e: CardEvent): EventCard {
  return {
    id: e.id,
    category: e.category,
    title: e.title,
    description: e.description,
    venue: e.venue,
    date: e.date.toISOString(),
    capacity: e.capacity,
    status: e.status,
    organizer: toUserCard(e.postedBy),
    registrationCount: e._count.registrations,
    registered: e.registrations.length > 0,
    createdAt: e.createdAt.toISOString(),
  };
}

export const adInclude = {
  event: { select: { id: true, title: true, category: true, date: true, venue: true } },
  createdBy: { select: userCardSelect },
} satisfies Prisma.AdInclude;

export function toAdCard(a: Prisma.AdGetPayload<{ include: typeof adInclude }>): AdCard {
  return {
    id: a.id,
    headline: a.headline,
    imageUrl: a.imageFile ? `/api/ads/${a.id}/image` : null,
    startsAt: a.startsAt.toISOString(),
    endsAt: a.endsAt.toISOString(),
    status: a.status,
    event: { ...a.event, date: a.event.date.toISOString() },
    createdBy: toUserCard(a.createdBy),
  };
}

// ---------- Opportunities ----------

export const opportunityInclude =(viewerId: number) =>
  ({
    adviser: { select: userCardSelect },
    applications: { where: { userId: viewerId }, select: { userId: true } },
  }) satisfies Prisma.OpportunityInclude;

export function toOpportunityCard(
  o: Prisma.OpportunityGetPayload<{ include: ReturnType<typeof opportunityInclude> }>,
  viewerId: number,
): OpportunityCard {
  return {
    id: o.id,
    kind: o.kind,
    title: o.title,
    description: o.description,
    deadline: o.deadline.toISOString(),
    slots: o.slots,
    createdAt: o.createdAt.toISOString(),
    adviser: toUserCard(o.adviser),
    applied: o.applications.length > 0,
    isOwner: o.adviserId === viewerId,
  };
}

// ---------- Publications ----------

export const publicationCardInclude = {
  author: { select: userCardSelect },
  coAuthors: { orderBy: { order: 'asc' }, include: { user: { select: userCardSelect } } },
} satisfies Prisma.PublicationInclude;

export type CardPublication = Prisma.PublicationGetPayload<{ include: typeof publicationCardInclude }>;

export function toPublicationCard(p: CardPublication): PublicationCard {
  return {
    id: p.id,
    title: p.title,
    abstract: p.abstract,
    keywords: tagsOf(p.keywords),
    visibility: p.visibility,
    authors: [toUserCard(p.author), ...p.coAuthors.map((c) => toUserCard(c.user))],
    department: p.author.profile?.department ?? '',
    hasPdf: Boolean(p.pdfFile),
    publishedAt: p.publishedAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
