/**
 * FeedPage — the community feed of approved works, opportunities and events ("/feed").
 * Filters, school, department, search and sort live in the URL query string.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { ShieldCheck, X } from 'lucide-react';
import { useFeed, useSidebar, type FeedFilter, type FeedParams } from '../api/feed';
import { useFollows, useUnfollow } from '../api/follows';
import { departmentLabel, schoolLabel } from '../api/institutions';
import { AdSlot, CalendarLeaf, EventCard } from '../components/events/EventBits';
import { OpportunityEntry } from '../components/feed/OpportunityEntry';
import { PageHeader } from '../components/layout/PageHeader';
import { Updates } from '../components/notifications/Updates';
import { FollowButton } from '../components/people/FollowButton';
import { Person } from '../components/people/Person';
import { WorkEntry } from '../components/works/WorkEntry';
import { Button } from '../components/ui/Button';
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
  { value: 'following', label: 'Following' },
];

export function FeedPage() {
  const [params, setParams] = useSearchParams();
  const p: FeedParams = {
    type: (filters.find((f) => f.value === params.get('type'))?.value ?? 'all') as FeedFilter,
    institution: params.get('institution') ?? '',
    dept: params.get('dept') ?? '',
    year: params.get('year') ?? '',
    adviser: params.get('adviser') ?? '',
    tag: params.get('tag') ?? '',
    q: params.get('q') ?? '',
    sort: params.get('sort') === 'discussed' ? 'discussed' : 'newest',
  };
  const { data, isPending, isFetching, error } = useFeed(p);
  const narrowed = Boolean(p.institution || p.dept || p.year || p.adviser || p.tag);
  const deptCard = data?.departments.find((d) => String(d.id) === p.dept);
  // A keyword reached from a work's tag may be outside the most-used list: keep it selectable
  const tags = data ? (p.tag && !data.tags.some((t) => t.name === p.tag) ? [{ name: p.tag, count: 0 }, ...data.tags] : data.tags) : [];
  const clearFilters = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        ['institution', 'dept', 'year', 'adviser', 'tag'].forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );
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
              {(data?.institutions.length ?? 0) > 1 && (
                <SelectField label="School" value={p.institution} onChange={(e) => set('institution', e.target.value)} className={styles.filter}>
                  <option value="">Every school</option>
                  {data!.institutions.map((s) => (
                    <option key={s.id} value={String(s.id)}>
                      {schoolLabel(s)}
                    </option>
                  ))}
                </SelectField>
              )}
              <SelectField label="Department" value={p.dept} onChange={(e) => set('dept', e.target.value)} className={styles.dept}>
                <option value="">All departments</option>
                {data?.departments
                  .filter((d) => !p.institution || String(d.institution?.id ?? '') === p.institution)
                  .map((d) => (
                    <option key={d.id} value={String(d.id)}>
                      {departmentLabel(d)}
                    </option>
                  ))}
              </SelectField>
              <SelectField label="Year" value={p.year} onChange={(e) => set('year', e.target.value)} className={styles.filter}>
                <option value="">Any year</option>
                {data?.years.map((y) => (
                  <option key={y} value={String(y)}>
                    {y}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Adviser" value={p.adviser} onChange={(e) => set('adviser', e.target.value)} className={styles.filter}>
                <option value="">Any adviser</option>
                {data?.advisers.map((a) => (
                  <option key={a.id} value={String(a.id)}>
                    {a.name}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Keyword" value={p.tag} onChange={(e) => set('tag', e.target.value)} className={styles.filter}>
                <option value="">Any keyword</option>
                {tags.map((t) => (
                  <option key={t.name} value={t.name}>
                    {t.count ? `${t.name} (${t.count})` : t.name}
                  </option>
                ))}
              </SelectField>
              {narrowed && (
                <Button variant="ghost" icon={<X size={16} aria-hidden="true" />} onClick={clearFilters}>
                  Clear filters
                </Button>
              )}
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

          {(p.dept || p.tag) && (
            <div className={styles.follows}>
              {p.dept && <FollowButton kind="department" target={p.dept} label={deptCard ? departmentLabel(deptCard) : 'this department'} />}
              {p.tag && <FollowButton kind="tag" target={p.tag} label={`the keyword “${p.tag}”`} />}
              <span className={styles.followsHint}>See new works from {p.dept && p.tag ? 'these' : 'it'} under Following.</span>
            </div>
          )}

          {p.type === 'following' && <YouFollow />}

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
              <EmptyState title={p.type === 'saved' ? 'Your library is empty' : p.type === 'following' ? 'Nothing from what you follow yet' : 'Nothing matches yet'}>
                {p.type === 'saved'
                  ? 'Save works from the feed and they’ll wait for you here.'
                  : p.type === 'following'
                    ? 'Follow people from their portfolios, or a department or keyword from the filters above.'
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

/** The Following filter's header: everyone and everything I follow, each with an unfollow button. */
function YouFollow() {
  const { data } = useFollows();
  const unfollow = useUnfollow();
  if (!data) return null;
  const items = [
    ...data.people.map((u) => ({ key: `p${u.id}`, kind: 'person' as const, target: String(u.id), label: u.name, to: `/u/${u.username}` })),
    ...data.departments.map((d) => ({ key: `d${d.id}`, kind: 'department' as const, target: String(d.id), label: departmentLabel(d), to: `/feed?dept=${d.id}` })),
    ...data.tags.map((t) => ({ key: `t${t}`, kind: 'tag' as const, target: t, label: t, to: `/feed?tag=${encodeURIComponent(t)}` })),
  ];
  if (items.length === 0) return null;
  return (
    <Sheet title="You follow" aside={String(items.length)}>
      <ul className={styles.followed}>
        {items.map((i) => (
          <li key={i.key} className={styles.followedItem}>
            <Link to={i.to} className={styles.followedLink}>
              {i.kind === 'tag' ? `#${i.label}` : i.label}
            </Link>
            <button
              type="button"
              className={styles.unfollow}
              aria-label={`Unfollow ${i.label}`}
              disabled={unfollow.isPending}
              onClick={() => unfollow.mutate({ kind: i.kind, target: i.target })}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
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
