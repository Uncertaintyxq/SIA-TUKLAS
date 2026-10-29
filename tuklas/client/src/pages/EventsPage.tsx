/**
 * EventsPage — the list of academic events and your own events and ad requests ("/events").
 * Verified educators propose events for admin approval; admins post them directly.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarPlus, ShieldCheck } from 'lucide-react';
import type { EventCategory } from '@server/schemas/events';
import { useMe } from '../api/auth';
import { useCreateEvent, useEvents } from '../api/events';
import { PageHeader } from '../components/layout/PageHeader';
import { CalendarLeaf, EventCard } from '../components/events/EventBits';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Chips } from '../components/ui/Chips';
import { EmptyState } from '../components/ui/EmptyState';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Notice } from '../components/ui/Notice';
import { Sheet } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { fmtDate, fmtDateTime, toLocalInput } from '../lib/format';
import { approvalLabel, approvalTone, categoryLabel } from '../lib/labels';
import styles from './EventsPage.module.css';

export function EventsPage() {
  const { data: me } = useMe();
  const { data, isPending } = useEvents();
  const [category, setCategory] = useState<EventCategory | 'all'>('all');
  const [formKey, setFormKey] = useState(0);
  const [proposing, setProposing] = useState(false);
  const canPropose = me && (me.role === 'admin' || (me.role === 'educator' && me.verified));
  const shown = data?.upcoming.filter((e) => category === 'all' || e.category === category) ?? [];

  return (
    <>
      <PageHeader
        title="Academic events"
        description="Research colloquiums, thesis defenses, research fairs, school innovations and the C.P. Garcia event. Advertising on Tuklas is limited to academic events."
        actions={
          canPropose && (
            <Button
              variant="primary"
              icon={<CalendarPlus size={18} aria-hidden="true" />}
              onClick={() => {
                setFormKey((k) => k + 1);
                setProposing(true);
              }}
            >
              {me.role === 'admin' ? 'Post an event' : 'Propose an event'}
            </Button>
          )
        }
      />

      <div className={styles.stack}>
        {(data?.mine.length ?? 0) > 0 && (
          <Sheet title="Your events" aside={String(data!.mine.length)} flush>
            <ul className={styles.mine}>
              {data!.mine.map((e) => (
                <li key={e.id}>
                  <Link to={`/events/${e.id}`} className={styles.mineRow}>
                    <CalendarLeaf date={e.date} small />
                    <span className={styles.mineText}>
                      <span className={styles.mineTitle}>{e.title}</span>
                      <span className={styles.mineMeta}>
                        {categoryLabel[e.category]} · {fmtDateTime(e.date)} · {e.registrationCount} registered
                      </span>
                    </span>
                    <Badge tone={approvalTone[e.status]}>{approvalLabel[e.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Sheet>
        )}

        {(data?.myAds.length ?? 0) > 0 && (
          <Sheet title="Your ad requests" flush>
            <ul className={styles.mine}>
              {data!.myAds.map((a) => (
                <li key={a.id}>
                  <Link to={`/events/${a.event.id}`} className={styles.mineRow}>
                    <span className={styles.mineText}>
                      <span className={styles.mineTitle}>{a.headline}</span>
                      <span className={styles.mineMeta}>
                        {a.event.title} · runs {fmtDate(a.startsAt)} – {fmtDate(a.endsAt)}
                      </span>
                    </span>
                    <Badge tone={approvalTone[a.status]}>{approvalLabel[a.status]}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          </Sheet>
        )}

        <Chips
          label="Filter events"
          value={category}
          onChange={setCategory}
          options={[{ value: 'all', label: 'All' }, ...(Object.keys(categoryLabel) as EventCategory[]).map((c) => ({ value: c, label: categoryLabel[c] }))]}
        />

        {isPending ? (
          <div className={styles.grid}>
            <Skeleton className={styles.skeleton} />
            <Skeleton className={styles.skeleton} />
          </div>
        ) : shown.length === 0 ? (
          <EmptyState title="No upcoming events here">Approved academic events appear here once an admin approves them.</EmptyState>
        ) : (
          <div className={styles.grid}>
            {shown.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}

        {(data?.past.length ?? 0) > 0 && (
          <details className={styles.past}>
            <summary>Past events</summary>
            <ul className={styles.pastList}>
              {data!.past.map((e) => (
                <li key={e.id}>
                  <Link to={`/events/${e.id}`}>{e.title}</Link> <span className={styles.mineMeta}>· {fmtDate(e.date)}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      {canPropose && <EventForm key={formKey} open={proposing} onClose={() => setProposing(false)} isAdmin={me.role === 'admin'} />}
    </>
  );
}

/** Modal form to propose (educator) or publish (admin) an academic event. */
function EventForm({ open, onClose, isAdmin }: { open: boolean; onClose: () => void; isAdmin: boolean }) {
  const [category, setCategory] = useState<EventCategory>('colloquium');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const d = new Date(Date.now() + 14 * 86_400_000);
    d.setHours(9, 0, 0, 0);
    return toLocalInput(d);
  });
  const [venue, setVenue] = useState('');
  const [capacity, setCapacity] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateEvent();
  const toast = useToast();
  const navigate = useNavigate();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { category, title, venue, description, date: new Date(date).toISOString(), capacity: capacity ? Number(capacity) : null },
      {
        onSuccess: ({ id }) => {
          toast(isAdmin ? 'Event published.' : 'Submitted. An admin will review it before it’s listed.', 'success');
          onClose();
          navigate(`/events/${id}`);
        },
      },
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isAdmin ? 'Post an academic event' : 'Propose an academic event'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="event-form" variant="primary" loading={create.isPending}>
            {isAdmin ? 'Publish event' : 'Submit for approval'}
          </Button>
        </>
      }
    >
      <form id="event-form" className={styles.form} onSubmit={submit}>
        <Notice tone="gold" icon={<ShieldCheck size={18} aria-hidden="true" />}>
          Only academic events can be posted. {isAdmin ? 'As an admin, your event is listed immediately.' : 'An admin reviews your event before it’s listed.'}
        </Notice>
        <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value as EventCategory)}>
          {(Object.keys(categoryLabel) as EventCategory[]).map((c) => (
            <option key={c} value={c}>
              {categoryLabel[c]}
            </option>
          ))}
        </SelectField>
        <TextField label="Event title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={140} />
        <div className={styles.row}>
          <TextField label="Date and time" type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required />
          <TextField label="Seats (optional)" type="number" min={1} max={5000} value={capacity} onChange={(e) => setCapacity(e.target.value)} />
        </div>
        <TextField label="Venue" value={venue} onChange={(e) => setVenue(e.target.value)} required maxLength={160} />
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} required minLength={20} rows={4} />
        {create.error && (
          <p className={styles.error} role="alert">
            {create.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
