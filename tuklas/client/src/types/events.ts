/** Academic events and their ad slots (/api/events, /api/ads). */
import type { UserCard } from './common';

/** Advertising and events are limited to academic ones. */
export type EventCategory = 'colloquium' | 'defense' | 'fair' | 'innovation' | 'cpgarcia';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface EventInput {
  category: EventCategory;
  title: string;
  description: string;
  venue: string;
  /** In the future */
  date: string | Date;
  capacity?: number | null;
}

export interface AdInput {
  headline: string;
  startsAt: string | Date;
  /** After startsAt */
  endsAt: string | Date;
}

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
