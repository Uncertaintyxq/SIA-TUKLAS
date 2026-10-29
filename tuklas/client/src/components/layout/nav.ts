/**
 * Navigation per role. The rail shows every item; the phone bottom bar shows the
 * `primary` ones and puts the rest under "More".
 */
import {
  BookUser,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Library,
  Megaphone,
  MessagesSquare,
  Newspaper,
  NotebookPen,
  ShieldCheck,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@server/schemas/auth';

/** Counters a nav item can carry. */
export type NavBadge = 'messages' | 'announcements';

export interface NavItem {
  to: string;
  label: string;
  /** Shorter label for the phone bottom bar. */
  short: string;
  icon: LucideIcon;
  badge?: NavBadge;
  /** On the phone bottom bar; the rest sit under More */
  primary?: boolean;
}

const feed: NavItem = { to: '/feed', label: 'Community feed', short: 'Feed', icon: Newspaper, primary: true };
const announcements: NavItem = { to: '/announcements', label: 'Announcements', short: 'News', icon: Megaphone, badge: 'announcements', primary: true };
const messages: NavItem = { to: '/messages', label: 'Messages', short: 'Chat', icon: MessagesSquare, badge: 'messages', primary: true };
const research: NavItem = { to: '/research', label: 'My research', short: 'Research', icon: NotebookPen };
const groups: NavItem = { to: '/groups', label: 'Research groups', short: 'Groups', icon: Users };
const library: NavItem = { to: '/library', label: 'Research library', short: 'Library', icon: Library };
const events: NavItem = { to: '/events', label: 'Academic events', short: 'Events', icon: CalendarDays };
const portfolio: NavItem = { to: '/portfolio', label: 'My portfolio', short: 'Portfolio', icon: BookUser };

export function navFor(role: Role): NavItem[] {
  switch (role) {
    case 'student':
      return [feed, announcements, messages, { ...research, primary: true }, groups, library, events, portfolio];
    case 'educator':
      return [
        feed,
        announcements,
        messages,
        research,
        groups,
        { to: '/review', label: 'Review board', short: 'Review', icon: ClipboardCheck, primary: true },
        { to: '/post', label: 'Post opportunity', short: 'Post', icon: Briefcase },
        library,
        events,
        portfolio,
      ];
    case 'admin':
      // Direct messages are for students and educators; admins see group chat from each group's page.
      return [
        feed,
        announcements,
        { to: '/admin', label: 'Approval queue', short: 'Queue', icon: ShieldCheck, primary: true },
        groups,
        library,
        { ...events, primary: true },
        portfolio,
      ];
  }
}
