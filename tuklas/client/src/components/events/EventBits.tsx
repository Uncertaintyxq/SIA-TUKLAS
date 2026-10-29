/**
 * EventBits — shared pieces for showing events: calendar leaf, register button, event card and ad slot.
 * Used by the events pages and the feed sidebar.
 */
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarCheck, MapPin, Users } from 'lucide-react';
import type { AdCard, EventCard as EventData, EventCategory } from '@server/schemas/events';
import { useRegister } from '../../api/events';
import { fmtDateTime, monthShort, plural } from '../../lib/format';
import { categoryLabel } from '../../lib/labels';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import styles from './EventBits.module.css';

export const categoryTone: Record<EventCategory, BadgeTone> = { colloquium: 'purple', defense: 'blue', fair: 'ok', innovation: 'gold', cpgarcia: 'warn' };

/** A torn-off calendar leaf: month over day, in mono. */
export function CalendarLeaf({ date, small = false }: { date: string; small?: boolean }) {
  return (
    <span className={clsx(styles.leaf, small && styles.small)} aria-hidden="true">
      <span className={styles.month}>{monthShort(date)}</span>
      <span className={styles.day}>{new Date(date).getDate()}</span>
    </span>
  );
}

/** Toggles the viewer's registration; hidden for past or unapproved events. */
export function RegisterButton({ event, block = false }: { event: EventData; block?: boolean }) {
  const register = useRegister();
  const toast = useToast();
  const past = new Date(event.date).getTime() < Date.now();
  const full = event.capacity !== null && event.registrationCount >= event.capacity && !event.registered;
  if (event.status !== 'approved' || past) return null;
  return (
    <Button
      variant={event.registered ? 'secondary' : 'primary'}
      block={block}
      icon={event.registered ? <CalendarCheck size={17} aria-hidden="true" /> : undefined}
      disabled={full}
      loading={register.isPending}
      aria-pressed={event.registered}
      onClick={() =>
        register.mutate(
          { id: event.id, register: !event.registered },
          {
            onSuccess: () => toast(event.registered ? 'Registration cancelled.' : `You’re registered for ${event.title}.`, event.registered ? 'info' : 'success'),
            onError: (e) => toast(e.message, 'error'),
          },
        )
      }
    >
      {full ? 'Full' : event.registered ? 'Registered' : 'Register'}
    </Button>
  );
}

/** An event as a card: calendar leaf, category, title, venue, seats. */
export function EventCard({ event, showRegister = true }: { event: EventData; showRegister?: boolean }) {
  return (
    <article className={styles.card}>
      <span className={clsx(styles.band, styles[event.category])} aria-hidden="true" />
      <div className={styles.cardBody}>
        <div className={styles.cardHead}>
          <CalendarLeaf date={event.date} />
          <div className={styles.cardTitle}>
            <Badge tone={categoryTone[event.category]}>{categoryLabel[event.category]}</Badge>
            <h3 className={styles.title}>
              <Link to={`/events/${event.id}`} className={styles.titleLink}>
                {event.title}
              </Link>
            </h3>
          </div>
        </div>
        <p className={styles.description}>{event.description}</p>
        <ul className={styles.facts}>
          <li>
            <CalendarCheck size={15} aria-hidden="true" />
            {fmtDateTime(event.date)}
          </li>
          <li>
            <MapPin size={15} aria-hidden="true" />
            {event.venue}
          </li>
          <li>
            <Users size={15} aria-hidden="true" />
            {plural(event.registrationCount, 'registration')}
            {event.capacity !== null && ` of ${event.capacity} seats`}
          </li>
        </ul>
        {showRegister && (
          <div className={styles.cardFoot}>
            <span className={styles.organizer}>By {event.organizer.name}</span>
            <RegisterButton event={event} />
          </div>
        )}
      </div>
    </article>
  );
}

/** An academic ad slot in the feed sidebar. Admin-approved event promos only. */
export function AdSlot({ ad }: { ad: AdCard }) {
  return (
    <Link to={`/events/${ad.event.id}`} className={styles.ad}>
      {ad.imageUrl && <img src={ad.imageUrl} alt="" className={styles.adImage} loading="lazy" />}
      <span className={styles.adBody}>
        <span className={styles.kicker}>{categoryLabel[ad.event.category]}</span>
        <span className={styles.adHeadline}>{ad.headline}</span>
        <span className={styles.adMeta}>
          <CalendarLeaf date={ad.event.date} small />
          <span>
            <span className={styles.adEvent}>{ad.event.title}</span>
            <span className={styles.adVenue}>{ad.event.venue}</span>
          </span>
        </span>
      </span>
    </Link>
  );
}
