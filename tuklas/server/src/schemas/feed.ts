/**
 * Feed schemas — validate the feed query, opportunity postings and applications.
 * Exports FeedItem, FeedResponse, OpportunityCard and SidebarResponse for the client.
 */
import { z } from 'zod';
import type { UserCard } from './common.js';
import type { AdCard, EventCard } from './events.js';
import type { WorkCard } from './works.js';

export const feedFilters = ['all', 'research', 'literary', 'innovation', 'opportunities', 'events', 'saved'] as const;
export type FeedFilter = (typeof feedFilters)[number];

export const feedQuery = z.object({
  type: z.enum(feedFilters).catch('all'),
  dept: z.string().trim().max(160).catch(''),
  q: z.string().trim().max(100).catch(''),
  sort: z.enum(['newest', 'discussed']).catch('newest'),
});
export type FeedQuery = z.infer<typeof feedQuery>;

export const opportunityKinds = ['mentorship', 'grant', 'call'] as const;
export type OpportunityKind = (typeof opportunityKinds)[number];

export const opportunitySchema = z.object({
  kind: z.enum(opportunityKinds),
  title: z.string().trim().min(5, 'Give the posting a title of at least 5 characters').max(140),
  description: z.string().trim().min(20, 'Describe the opportunity in at least 20 characters').max(4000),
  deadline: z.coerce.date({ error: 'Enter the application deadline' }).refine((d) => d.getTime() > Date.now() - 86_400_000, 'Choose a deadline that hasn’t passed'),
  slots: z.number().int().min(1).max(99).nullable().default(null),
});
export type OpportunityInput = z.input<typeof opportunitySchema>;

export const applicationSchema = z.object({
  message: z.string().trim().min(10, 'Tell the adviser a little about yourself (10+ characters)').max(1000),
});

export interface OpportunityCard {
  id: number;
  kind: OpportunityKind;
  title: string;
  description: string;
  deadline: string;
  slots: number | null;
  createdAt: string;
  adviser: UserCard;
  applied: boolean;
  isOwner: boolean;
}

export interface MyOpportunity extends OpportunityCard {
  applications: { user: UserCard; message: string; createdAt: string }[];
}

export type FeedItem =
  | { kind: 'work'; at: string; work: WorkCard }
  | { kind: 'opportunity'; at: string; opportunity: OpportunityCard }
  | { kind: 'event'; at: string; event: EventCard };

export interface FeedResponse {
  items: FeedItem[];
  /** People whose name, program or department matches the search */
  people: UserCard[];
  departments: string[];
}

export interface SidebarResponse {
  ads: AdCard[];
  upcoming: EventCard[];
}
