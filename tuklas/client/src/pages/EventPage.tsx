/**
 * EventPage — the detail page for one academic event ("/events/:id").
 * Organizers and admins also see the attendee list and can request a feed ad slot.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarCheck, MapPin, Megaphone, Trash2, Users } from 'lucide-react';
import { useCreateAd, useDeleteAd, useDeleteEvent, useEvent, type EventDetail } from '../api/events';
import { CalendarLeaf, RegisterButton, categoryTone } from '../components/events/EventBits';
import { Person } from '../components/people/Person';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { FileField, TextField } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { fmtDate, fmtDateTime, isoDate, plural, relTime } from '../lib/format';
import { approvalLabel, approvalTone, categoryLabel } from '../lib/labels';
import styles from './EventPage.module.css';

export function EventPage() {
  const id = Number(useParams().id);
  const { data: e, isPending, error } = useEvent(id);
  const del = useDeleteEvent();
  const toast = useToast();
  const navigate = useNavigate();

  if (isPending) return <Skeleton className={styles.skeleton} />;
  if (error || !e)
    return (
      <EmptyState title="This event isn’t listed" action={<ButtonLink to="/events">All events</ButtonLink>}>
        It may still be waiting for admin approval, or it was cancelled.
      </EmptyState>
    );

  const manage = e.attendees !== null;
  return (
    <div className={styles.page}>
      <article className={styles.event}>
        <span className={styles.band} aria-hidden="true" />
        <div className={styles.body}>
          <div className={styles.head}>
            <CalendarLeaf date={e.date} />
            <div className={styles.titleBlock}>
              <div className={styles.badges}>
                <Badge tone={categoryTone[e.category]}>{categoryLabel[e.category]}</Badge>
                {e.status !== 'approved' && <Badge tone={approvalTone[e.status]}>{approvalLabel[e.status]}</Badge>}
              </div>
              <h1 className={styles.title}>{e.title}</h1>
            </div>
          </div>
          <ul className={styles.facts}>
            <li>
              <CalendarCheck size={17} aria-hidden="true" />
              {fmtDateTime(e.date)}
            </li>
            <li>
              <MapPin size={17} aria-hidden="true" />
              {e.venue}
            </li>
            <li>
              <Users size={17} aria-hidden="true" />
              {plural(e.registrationCount, 'registration')}
              {e.capacity !== null && ` · ${Math.max(e.capacity - e.registrationCount, 0)} of ${e.capacity} seats left`}
            </li>
          </ul>
          <p className={styles.description}>{e.description}</p>
          <div className={styles.foot}>
            <Person user={e.organizer} sub="Organizer" />
            <div className={styles.footActions}>
              <RegisterButton event={e} />
              {manage && (
                <Button
                  variant="danger"
                  icon={<Trash2 size={16} aria-hidden="true" />}
                  loading={del.isPending}
                  onClick={() =>
                    window.confirm(`Cancel “${e.title}”? Registered attendees will be notified.`) &&
                    del.mutate(e.id, {
                      onSuccess: () => {
                        toast('Event cancelled.');
                        navigate('/events', { replace: true });
                      },
                      onError: (err) => toast(err.message, 'error'),
                    })
                  }
                >
                  Cancel event
                </Button>
              )}
            </div>
          </div>
          {e.status === 'pending' && <Notice tone="gold">An admin will review this event before it’s listed and open for registration.</Notice>}
        </div>
      </article>

      {manage && (
        <div className={styles.manage}>
          <Sheet title="Attendees" aside={String(e.attendees!.length)} flush>
            {e.attendees!.length === 0 ? (
              <SheetEmpty>No one has registered yet.</SheetEmpty>
            ) : (
              <ol className={styles.attendees}>
                {e.attendees!.map((a) => (
                  <li key={a.user.id} className={styles.attendee}>
                    <Person user={a.user} size="sm" />
                    <time className={styles.when}>{relTime(a.registeredAt)}</time>
                  </li>
                ))}
              </ol>
            )}
          </Sheet>
          <Promote event={e} />
        </div>
      )}
    </div>
  );
}

/** Request an academic ad slot: a promo shown in the feed sidebar once an admin approves it. */
function Promote({ event: e }: { event: EventDetail }) {
  const [headline, setHeadline] = useState('');
  const [startsAt, setStartsAt] = useState(() => isoDate(new Date().toISOString()));
  const [endsAt, setEndsAt] = useState(() => isoDate(e.date));
  const [image, setImage] = useState<File | null>(null);
  const create = useCreateAd();
  const remove = useDeleteAd();
  const toast = useToast();

  const submit = (ev: FormEvent) => {
    ev.preventDefault();
    create.mutate(
      { eventId: e.id, headline, startsAt: `${startsAt}T00:00:00`, endsAt: `${endsAt}T23:59:00`, image },
      {
        onSuccess: ({ status }) => {
          toast(status === 'approved' ? 'Ad slot is live in the feed.' : 'Ad requested. An admin will review it.', 'success');
          setHeadline('');
          setImage(null);
        },
      },
    );
  };

  return (
    <Sheet title="Promote in the feed" aside="Academic ad slot">
      <div className={styles.promote}>
        {e.ads.length > 0 && (
          <ul className={styles.ads}>
            {e.ads.map((a) => (
              <li key={a.id} className={styles.ad}>
                {a.imageUrl && <img src={a.imageUrl} alt="" className={styles.adImage} />}
                <span className={styles.adText}>
                  <span className={styles.adHeadline}>{a.headline}</span>
                  <span className={styles.adMeta}>
                    {fmtDate(a.startsAt)} – {fmtDate(a.endsAt)}
                  </span>
                  <Badge tone={approvalTone[a.status]}>{approvalLabel[a.status]}</Badge>
                </span>
                <button
                  type="button"
                  className={styles.removeAd}
                  onClick={() => window.confirm('Remove this ad?') && remove.mutate(a.id, { onSuccess: () => toast('Ad removed.') })}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span className="sr-only">Remove ad</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {e.canPromote ? (
          <form className={styles.form} onSubmit={submit}>
            <TextField label="Headline" value={headline} onChange={(ev) => setHeadline(ev.target.value)} required minLength={5} maxLength={120} placeholder="e.g. See this year’s best theses presented live" />
            <div className={styles.row}>
              <TextField label="Show from" type="date" value={startsAt} onChange={(ev) => setStartsAt(ev.target.value)} required />
              <TextField label="Until" type="date" value={endsAt} onChange={(ev) => setEndsAt(ev.target.value)} required max={isoDate(e.date)} />
            </div>
            <FileField label="Image (optional)" accept="image/png,image/jpeg,image/webp" file={image} onFile={setImage} hint="A wide image works best. PNG, JPEG or WebP, up to 5 MB." />
            {create.error && (
              <p className={styles.error} role="alert">
                {create.error.message}
              </p>
            )}
            <Button type="submit" variant="primary" icon={<Megaphone size={17} aria-hidden="true" />} loading={create.isPending}>
              Request ad slot
            </Button>
          </form>
        ) : (
          <p className={styles.quiet}>Ad slots open once the event is approved, until it starts.</p>
        )}
      </div>
    </Sheet>
  );
}
