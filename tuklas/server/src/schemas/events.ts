/**
 * Event schemas — validate academic events and their ad (promo) requests.
 * Exports EventCard, EventDetail, AdCard and EventsResponse for the client.
 */
import { z } from 'zod';
import type { UserCard } from './common.js';

/** Advertising and events are limited to academic ones; anything else fails validation and the MySQL ENUM. */
export const eventCategories = ['colloquium', 'defense', 'fair', 'innovation', 'cpgarcia'] as const;
export type EventCategory = (typeof eventCategories)[number];
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export const eventSchema = z.object({
  category: z.enum(eventCategories, { error: 'Only academic events can be posted on Tuklas.' }),
  title: z.string().trim().min(5, 'Give the event a title of at least 5 characters').max(140),
  description: z.string().trim().min(20, 'Describe the event in at least 20 characters').max(4000),
  venue: z.string().trim().min(2, 'Enter the venue').max(160),
  date: z.coerce.date({ error: 'Enter the date and time' }).refine((d) => d.getTime() > Date.now() - 60_000, 'Choose a date in the future'),
  capacity: z.number().int().min(1).max(5000).nullable().default(null),
});
export type EventInput = z.input<typeof eventSchema>;

export const adSchema = z
  .object({
    headline: z.string().trim().min(5, 'Write a headline of at least 5 characters').max(120),
    startsAt: z.coerce.date({ error: 'Enter when the promo starts' }),
    endsAt: z.coerce.date({ error: 'Enter when the promo ends' }),
  })
  .refine((a) => a.endsAt > a.startsAt, { message: 'The promo must end after it starts', path: ['endsAt'] });
export type AdInput = z.input<typeof adSchema>;

export interface EventCard {
  id: number;
  category: EventCategory;
  title: string;
  description: string;
  venue: string;
  date: string;
  capacity: number | null;
  status: ApprovalStatus;
  organizer: UserCard;
  registrationCount: number;
  registered: boolean;
  createdAt: string;
}

export interface AdCard {
  id: number;
  headline: string;
  imageUrl: string | null;
  startsAt: string;
  endsAt: string;
  status: ApprovalStatus;
  event: { id: number; title: string; category: EventCategory; date: string; venue: string };
  createdBy: UserCard;
}

export interface EventDetail extends EventCard {
  isOrganizer: boolean;
  canRegister: boolean;
  canPromote: boolean;
  /** Organizer and admins only */
  attendees: { user: UserCard; registeredAt: string }[] | null;
  ads: AdCard[];
}

export interface EventsResponse {
  upcoming: EventCard[];
  past: EventCard[];
  /** Events you proposed, in every status (educators and admins) */
  mine: EventCard[];
  /** Your ad requests */
  myAds: AdCard[];
}
