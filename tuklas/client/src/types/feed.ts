/** The community feed, its sidebar, and adviser opportunities (/api/feed, /api/opportunities). */
import type { Audience, DepartmentCard, InstitutionCard, UserCard } from './common';
import type { AdCard, EventCard } from './events';
import type { WorkCard } from './works';

export type FeedFilter = 'all' | 'research' | 'literary' | 'innovation' | 'opportunities' | 'events' | 'saved' | 'following';
export type OpportunityKind = 'mentorship' | 'grant' | 'call';

export interface OpportunityInput {
  kind: OpportunityKind;
  title: string;
  description: string;
  /** Not in the past */
  deadline: string | Date;
  slots?: number | null;
  /** The posting school only (the default), or every school */
  audience?: Audience;
}

export interface OpportunityCard {
  audience: Audience;
  institution: InstitutionCard | null;
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

/** A keyword and how many items use it */
export interface KeywordCount {
  name: string;
  count: number;
}

export interface FeedResponse {
  items: FeedItem[];
  /** People whose name, program or department matches the search */
  people: UserCard[];
  departments: DepartmentCard[];
  /** Schools whose works are in the feed, for the School filter */
  institutions: InstitutionCard[];
  /** What the year, adviser and keyword filters can offer: values public works have */
  years: number[];
  advisers: UserCard[];
  tags: KeywordCount[];
}

export interface SidebarResponse {
  ads: AdCard[];
  upcoming: EventCard[];
}
