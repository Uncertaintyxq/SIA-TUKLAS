/**
 * FeedPage — the community feed of approved works, opportunities and events ("/feed").
 * Filters, department, search and sort live in the URL query string.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { useFeed, useSidebar, type FeedFilter, type FeedParams } from '../api/feed';
import { AdSlot, CalendarLeaf, EventCard } from '../components/events/EventBits';
import { OpportunityEntry } from '../components/feed/OpportunityEntry';
import { PageHeader } from '../components/layout/PageHeader';
import { Updates } from '../components/notifications/Updates';
import { Person } from '../components/people/Person';
import { WorkEntry } from '../components/works/WorkEntry';
import { Chips } from '../components/ui/Chips';
import { EmptyState } from '../components/ui/EmptyState';
import { SelectField } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { Segmented } from '../components/ui/Segmented';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { fmtDateTime } from '../lib/format';
import { categoryLabel, roleBadge } from '../lib/labels';
import styles from './FeedPage.module.css';

const filters: { value: FeedFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'research', label: 'Research' },
  { value: 'literary', label: 'Literary works' },
  { value: 'innovation', label: 'Innovations' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'events', label: 'Events' },
  { value: 'saved', label: 'My library' },
];

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const p: FeedParams = {
    type: (filters.find((f) => f.value === params.get('type'))?.value ?? 'all') as FeedFilter,
    dept: params.get('dept') ?? '',
    q: params.get('q') ?? '',
    sort: params.get('sort') === 'discussed' ? 'discussed' : 'newest',
  };
  const { data, isPending, isFetching, error } = useFeed(p);
  const set = (key: keyof FeedParams, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (!value || value === 'all' || value === 'newest') next.delete(key);
        else next.set(key, value);
        return next;
      },
      { replace: true },
    );

  return (
    <>
      <PageHeader title="Community feed" description="Approved research, literary works and adviser opportunities from across the university." />
      <div className={styles.layout}>
        <div className={styles.main}>
          <div className={styles.toolbar}>
            <Chips label="Filter the feed" value={p.type} options={filters} onChange={(v) => set('type', v)} />
            <div className={styles.controls}>
              <SelectField label="Department" value={p.dept} onChange={(e) => set('dept', e.target.value)} className={styles.dept}>
                <option value="">All departments</option>
                {data?.departments.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </SelectField>
              <div className={styles.sort}>
                <span className={styles.sortLabel} aria-hidden="true">
                  Sort
                </span>
                <Segmented
                  label="Sort"
                  value={p.sort}
                  onChange={(v) => set('sort', v)}
                  options={[
                    { value: 'newest', label: 'Newest' },
                    { value: 'discussed', label: 'Most discussed' },
                  ]}
                />
              </div>
            </div>
          </div>

          {p.q && (
            <div className={styles.searching}>
              <p>
                Results for <strong>“{p.q}”</strong>
              </p>
              <Link to="/feed" className={styles.clear}>
                <X size={16} aria-hidden="true" />
                Clear search
              </Link>
            </div>
          )}

          {p.q && (data?.people.length ?? 0) > 0 && (
            <Sheet title="People" aside={String(data!.people.length)}>
              <ul className={styles.people}>
                {data!.people.map((u) => (
                  <li key={u.id}>
                    <Person user={u} sub={`${roleBadge(u)} · ${u.department || u.program}`} />
                  </li>
                ))}
              </ul>
            </Sheet>
          )}

          <div className={styles.stream} aria-busy={isFetching}>
            {isPending ? (
              <>
                <Skeleton className={styles.skeleton} />
                <Skeleton className={styles.skeleton} />
              </>
            ) : error ? (
              <EmptyState title="The feed didn’t load">{error.message}</EmptyState>
            ) : data.items.length === 0 ? (
              <EmptyState title={p.type === 'saved' ? 'Your library is empty' : 'Nothing matches yet'}>
                {p.type === 'saved'
                  ? 'Save works from the feed and they’ll wait for you here.'
                  : p.q
                    ? 'Try another word, or clear the search.'
                    : 'Approved works, opportunities and events will appear here.'}
              </EmptyState>
            ) : (
              data.items.map((item) =>
                item.kind === 'work' ? (
                  <WorkEntry key={`w${item.work.id}`} work={item.work} />
                ) : item.kind === 'opportunity' ? (
                  <OpportunityEntry key={`o${item.opportunity.id}`} opportunity={item.opportunity} />
                ) : (
                  <EventCard key={`e${item.event.id}`} event={item.event} />
                ),
              )
            )}
          </div>
        </div>

        <aside className={styles.rail} aria-label="Updates and academic events">
          <Notice icon={<ShieldCheck size={18} aria-hidden="true" />}>
            <strong>Quality first.</strong> Student research appears here only after approval by a research adviser or the academic panel.
          </Notice>
          <Updates />
          <Sidebar />
        </aside>
      </div>
    </>
  );
}

/** Feed rail: approved academic ad slots and the next upcoming events. */
function Sidebar() {
  const { data } = useSidebar();
  return (
    <>
      {(data?.ads.length ?? 0) > 0 && (
        <Sheet title="Academic events" aside="Sponsored" flush className={styles.vellum}>
          {data!.ads.map((ad) => (
            <AdSlot key={ad.id} ad={ad} />
          ))}
        </Sheet>
      )}
      <Sheet title="Coming up" flush actions={<Link to="/events" className={styles.seeAll}>All events</Link>}>
        {!data || data.upcoming.length === 0 ? (
          <SheetEmpty>No upcoming academic events.</SheetEmpty>
        ) : (
          <ul className={styles.upcoming}>
            {data.upcoming.map((e) => (
              <li key={e.id}>
                <Link to={`/events/${e.id}`} className={styles.upcomingItem}>
                  <CalendarLeaf date={e.date} small />
                  <span className={styles.upcomingText}>
                    <span className={styles.kicker}>{categoryLabel[e.category]}</span>
                    <span className={styles.upcomingTitle}>{e.title}</span>
                    <span className={styles.upcomingMeta}>{fmtDateTime(e.date)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Sheet>
    </>
  );
}
