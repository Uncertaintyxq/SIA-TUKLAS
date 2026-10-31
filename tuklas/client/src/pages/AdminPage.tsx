/**
 * AdminPage — /admin. The admin dashboard: verify and monitor educators (and grant or revoke their rights),
 * approve research, events, ads and honors, manage roles, and moderate the feed.
 */
import { useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Award, CircleCheck, EyeOff, RotateCcw, Trash2, XCircle } from 'lucide-react';
import type { Role } from '../types/auth';
import {
  useAdminPosts,
  useAdminQueue,
  useAdminStats,
  useAdminUsers,
  useModerateAd,
  useModerateEvent,
  useModerateHonor,
  usePatchUser,
  useRemoveWork,
} from '../api/admin';
import { useMe } from '../api/auth';
import { useDeleteOpportunity } from '../api/feed';
import { useDecision, useDeleteDiscussion } from '../api/works';
import { EducatorMonitor } from '../components/admin/EducatorMonitor';
import { CalendarLeaf, categoryTone } from '../components/events/EventBits';
import { PageHeader } from '../components/layout/PageHeader';
import { Person } from '../components/people/Person';
import { StatusBadge, TypeTag } from '../components/works/WorkBadges';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Chips } from '../components/ui/Chips';
import { SelectField, TextField } from '../components/ui/Field';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { fmtDate, fmtDateTime, plural, relTime } from '../lib/format';
import { categoryLabel, honorLabel, roleBadge } from '../lib/labels';
import { useDebounced } from '../lib/useDebounced';
import styles from './AdminPage.module.css';

type Tab = 'research' | 'educators' | 'events' | 'ads' | 'honors' | 'users' | 'posts';
const tabs: Tab[] = ['research', 'educators', 'events', 'ads', 'honors', 'users', 'posts'];

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tab = (tabs.find((t) => t === params.get('tab')) ?? 'research') as Tab;
  const { data: stats } = useAdminStats();
  const { data: queue, isPending } = useAdminQueue();

  return (
    <>
      <PageHeader title="Approval queue" description="Verify and monitor educators, approve research, events and academic ads, verify honors, and moderate the feed." />

      <dl className={styles.kpis}>
        <Kpi label="Research awaiting the panel" value={stats?.works.inReview} />
        <Kpi label="Educators to verify" value={stats?.unverifiedEducators} />
        <Kpi label="Events pending" value={stats?.events.pending} />
        <Kpi label="Ad slots pending" value={stats?.ads.pending} />
        <Kpi label="Honors to verify" value={stats?.honorsPending} />
        <Kpi label="Published works" value={stats?.works.published} />
        <Kpi label="People" value={stats ? stats.users.student + stats.users.educator + stats.users.admin : undefined} note={stats && `${stats.users.student} students · ${stats.users.educator} educators`} />
        <Kpi label="Event registrations" value={stats?.events.registrations} note={stats && `${stats.ads.live} ads live · ${stats.groups} groups`} />
        <Kpi label="Educator research" value={stats?.publications.published} note={stats && `${stats.publications.drafts} drafts · ${stats.announcements} announcements`} />
      </dl>

      <div className={styles.tabs}>
        <Chips
          label="Queue"
          value={tab}
          onChange={(t) => setParams(t === 'research' ? {} : { tab: t }, { replace: true })}
          options={[
            { value: 'research', label: 'Student research', count: queue?.works.length },
            { value: 'educators', label: 'Educators', count: queue?.educators.length },
            { value: 'events', label: 'Events', count: queue?.events.length },
            { value: 'ads', label: 'Ad slots', count: queue?.ads.length },
            { value: 'honors', label: 'Honors & grants', count: queue?.honors.length },
            { value: 'users', label: 'Users & roles' },
            { value: 'posts', label: 'Moderate posts' },
          ]}
        />
      </div>

      {isPending && tab !== 'users' && tab !== 'posts' ? (
        <Skeleton className={styles.skeleton} />
      ) : (
        <>
          {tab === 'research' && <ResearchQueue works={queue!.works} />}
          {tab === 'educators' && (
            <div className={styles.stack}>
              <EducatorQueue educators={queue!.educators} />
              <EducatorMonitor />
            </div>
          )}
          {tab === 'events' && <EventQueue events={queue!.events} />}
          {tab === 'ads' && <AdQueue ads={queue!.ads} />}
          {tab === 'honors' && <HonorQueue honors={queue!.honors} />}
          {tab === 'users' && <Users />}
          {tab === 'posts' && <Posts />}
        </>
      )}
    </>
  );
}

function Kpi({ label, value, note }: { label: string; value: number | undefined; note?: ReactNode }) {
  return (
    <div className={styles.kpi}>
      <dt>{label}</dt>
      <dd>{value ?? '–'}</dd>
      {note && <span className={styles.kpiNote}>{note}</span>}
    </div>
  );
}

type Queue = NonNullable<ReturnType<typeof useAdminQueue>['data']>;

function Row({ lead, children, actions }: { lead?: ReactNode; children: ReactNode; actions: ReactNode }) {
  return (
    <li className={styles.row}>
      {lead && <span className={styles.lead}>{lead}</span>}
      <div className={styles.rowBody}>{children}</div>
      <div className={styles.rowActions}>{actions}</div>
    </li>
  );
}

function ResearchQueue({ works }: { works: Queue['works'] }) {
  const decide = useDecision();
  const toast = useToast();
  const run = (id: number, decision: 'approve' | 'reject', title: string) =>
    decide.mutate(
      { id, decision },
      {
        onSuccess: () => toast(decision === 'approve' ? `“${title}” approved by the panel and published.` : `“${title}” marked not approved.`, 'success'),
        onError: (e) => toast(e.message, 'error'),
      },
    );
  return (
    <Sheet title="Student research" aside="Submitted, under review or in revision" flush>
      {works.length === 0 ? (
        <SheetEmpty>No research waiting for the panel.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {works.map((w) => (
            <Row
              key={w.id}
              actions={
                <>
                  <ButtonLink to={`/works/${w.id}`}>Review</ButtonLink>
                  <Button variant="ok" disabled={decide.isPending} onClick={() => run(w.id, 'approve', w.title)}>
                    Panel approve
                  </Button>
                  <Button variant="danger" disabled={decide.isPending} onClick={() => window.confirm(`Reject “${w.title}”?`) && run(w.id, 'reject', w.title)}>
                    Reject
                  </Button>
                </>
              }
            >
              <span className={styles.badges}>
                <TypeTag type={w.type} />
                <StatusBadge status={w.status} />
                {w.openItems > 0 && <Badge tone="warn">{plural(w.openItems, 'open fix')}</Badge>}
              </span>
              <Link to={`/works/${w.id}`} className={styles.title}>
                {w.title}
              </Link>
              <span className={styles.meta}>
                {w.authors.map((a) => a.name).join(', ')} · Adviser: {w.adviser.name} · {w.submittedAt ? `submitted ${relTime(w.submittedAt)}` : ''}
              </span>
            </Row>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function EducatorQueue({ educators }: { educators: Queue['educators'] }) {
  const patch = usePatchUser();
  const toast = useToast();
  return (
    <Sheet title="Educators to verify" aside="Only verified educators can approve work" flush>
      {educators.length === 0 ? (
        <SheetEmpty>Every educator account is verified.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {educators.map((u) => (
            <Row
              key={u.id}
              actions={
                <>
                  <Button
                    variant="ok"
                    icon={<CircleCheck size={16} aria-hidden="true" />}
                    disabled={patch.isPending}
                    onClick={() => patch.mutate({ id: u.id, verified: true }, { onSuccess: () => toast(`${u.name} is now a verified educator.`, 'success'), onError: (e) => toast(e.message, 'error') })}
                  >
                    Verify
                  </Button>
                  <Button
                    disabled={patch.isPending}
                    onClick={() =>
                      window.confirm(`Change ${u.name} to a student account instead?`) &&
                      patch.mutate({ id: u.id, role: 'student' }, { onSuccess: () => toast(`${u.name} is now a student account.`), onError: (e) => toast(e.message, 'error') })
                    }
                  >
                    Make student
                  </Button>
                </>
              }
            >
              <Person user={u} sub={`${u.program}${u.department ? ` · ${u.department}` : ''}`} />
              <span className={styles.meta}>
                {u.email} · signed up {relTime(u.createdAt)}
              </span>
            </Row>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function EventQueue({ events }: { events: Queue['events'] }) {
  const moderate = useModerateEvent();
  const toast = useToast();
  return (
    <Sheet title="Events awaiting approval" flush>
      {events.length === 0 ? (
        <SheetEmpty>No events awaiting approval.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {events.map((e) => (
            <Row
              key={e.id}
              lead={<CalendarLeaf date={e.date} />}
              actions={
                <ApproveReject
                  pending={moderate.isPending}
                  approveLabel="Approve event"
                  onApprove={() => moderate.mutate({ id: e.id, approve: true }, { onSuccess: () => toast('Event approved and listed.', 'success') })}
                  onReject={() => moderate.mutate({ id: e.id, approve: false }, { onSuccess: () => toast('Event rejected.') })}
                />
              }
            >
              <Badge tone={categoryTone[e.category]}>{categoryLabel[e.category]}</Badge>
              <Link to={`/events/${e.id}`} className={styles.title}>
                {e.title}
              </Link>
              <span className={styles.meta}>
                {fmtDateTime(e.date)} · {e.venue} · proposed by {e.organizer.name}
              </span>
              <p className={styles.description}>{e.description}</p>
            </Row>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function AdQueue({ ads }: { ads: Queue['ads'] }) {
  const moderate = useModerateAd();
  const toast = useToast();
  return (
    <Sheet title="Academic ad slots" aside="Event promos for the feed sidebar" flush>
      {ads.length === 0 ? (
        <SheetEmpty>No ad slots awaiting approval.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {ads.map((a) => (
            <Row
              key={a.id}
              lead={a.imageUrl ? <img src={a.imageUrl} alt="" className={styles.adImage} /> : <CalendarLeaf date={a.event.date} />}
              actions={
                <ApproveReject
                  pending={moderate.isPending}
                  approveLabel="Approve ad"
                  onApprove={() => moderate.mutate({ id: a.id, approve: true }, { onSuccess: () => toast('Ad approved. It runs in the feed during its window.', 'success') })}
                  onReject={() => moderate.mutate({ id: a.id, approve: false }, { onSuccess: () => toast('Ad rejected.') })}
                />
              }
            >
              <span className={styles.title}>{a.headline}</span>
              <span className={styles.meta}>
                For <Link to={`/events/${a.event.id}`}>{a.event.title}</Link> ({categoryLabel[a.event.category]}) · runs {fmtDate(a.startsAt)} – {fmtDate(a.endsAt)} · requested by {a.createdBy.name}
              </span>
            </Row>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function HonorQueue({ honors }: { honors: Queue['honors'] }) {
  const moderate = useModerateHonor();
  const toast = useToast();
  return (
    <Sheet title="Honors & grants to verify" flush>
      {honors.length === 0 ? (
        <SheetEmpty>All honors and grants are verified.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {honors.map((h) => (
            <Row
              key={h.id}
              lead={<Award size={22} aria-hidden="true" className={styles.honorIcon} />}
              actions={
                <ApproveReject
                  pending={moderate.isPending}
                  approveLabel="Verify"
                  rejectLabel="Decline"
                  onApprove={() => moderate.mutate({ id: h.id, verify: true }, { onSuccess: () => toast('Honor verified.', 'success') })}
                  onReject={() => moderate.mutate({ id: h.id, verify: false }, { onSuccess: () => toast('Honor declined and removed.') })}
                />
              }
            >
              <Badge tone="neutral">{honorLabel[h.kind]}</Badge>
              <span className={styles.title}>{h.title}</span>
              <span className={styles.meta}>
                {h.issuer} · {h.year} · claimed by <Link to={`/u/${h.owner.username}`}>{h.owner.name}</Link>
              </span>
            </Row>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function ApproveReject({
  pending,
  approveLabel,
  rejectLabel = 'Reject',
  onApprove,
  onReject,
}: {
  pending: boolean;
  approveLabel: string;
  rejectLabel?: string;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <>
      <Button variant="ok" icon={<CircleCheck size={16} aria-hidden="true" />} disabled={pending} onClick={onApprove}>
        {approveLabel}
      </Button>
      <Button variant="danger" icon={<XCircle size={16} aria-hidden="true" />} disabled={pending} onClick={onReject}>
        {rejectLabel}
      </Button>
    </>
  );
}

function Users() {
  const { data: me } = useMe();
  const [q, setQ] = useState('');
  const [role, setRole] = useState<Role | ''>('');
  const term = useDebounced(q, 300);
  const { data: users, isPending } = useAdminUsers(term, role, true);
  const patch = usePatchUser();
  const toast = useToast();
  const change = (id: number, body: { role?: Role; verified?: boolean }, msg: string) =>
    patch.mutate({ id, ...body }, { onSuccess: () => toast(msg, 'success'), onError: (e) => toast(e.message, 'error') });

  return (
    <Sheet title="Users & roles" aside={users ? String(users.length) : undefined} flush>
      <div className={styles.filters}>
        <TextField label="Search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, email or username" className={styles.grow} />
        <SelectField label="Role" value={role} onChange={(e) => setRole(e.target.value as Role | '')}>
          <option value="">Everyone</option>
          <option value="student">Students</option>
          <option value="educator">Educators</option>
          <option value="admin">Admins</option>
        </SelectField>
      </div>
      {isPending ? (
        <Skeleton className={styles.skeleton} />
      ) : !users?.length ? (
        <SheetEmpty>No one matches.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {users.map((u) => (
            <Row
              key={u.id}
              actions={
                <>
                  <SelectField
                    label={`Role for ${u.name}`}
                    value={u.role}
                    disabled={u.id === me?.id || patch.isPending}
                    onChange={(e) => change(u.id, { role: e.target.value as Role }, `${u.name} is now ${e.target.value === 'admin' ? 'an admin' : `a ${e.target.value}`}.`)}
                    className={styles.roleSelect}
                  >
                    <option value="student">Student</option>
                    <option value="educator">Educator</option>
                    <option value="admin">Admin</option>
                  </SelectField>
                  {u.role === 'educator' && (
                    <Button disabled={patch.isPending} onClick={() => change(u.id, { verified: !u.verified }, u.verified ? `${u.name} is no longer verified.` : `${u.name} is verified.`)}>
                      {u.verified ? 'Unverify' : 'Verify'}
                    </Button>
                  )}
                </>
              }
            >
              <Person user={u} sub={`${roleBadge(u)} · ${u.email}`} />
              <span className={styles.meta}>
                {plural(u.works, 'work')} · joined {fmtDate(u.createdAt)}
              </span>
            </Row>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function Posts() {
  const { data, isPending } = useAdminPosts(true);
  const removeWork = useRemoveWork();
  const delOpp = useDeleteOpportunity();
  const delComment = useDeleteDiscussion();
  const toast = useToast();
  if (isPending || !data) return <Skeleton className={styles.skeleton} />;
  return (
    <div className={styles.posts}>
      <Sheet title="Published works" aside={String(data.works.length)} flush>
        {data.works.length === 0 ? (
          <SheetEmpty>No published works.</SheetEmpty>
        ) : (
          <ul className={styles.list}>
            {data.works.map((w) => (
              <Row
                key={w.id}
                actions={
                  w.removedAt ? (
                    <Button icon={<RotateCcw size={16} aria-hidden="true" />} onClick={() => removeWork.mutate({ id: w.id, remove: false }, { onSuccess: () => toast('Restored to the feed.', 'success') })}>
                      Restore
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      icon={<EyeOff size={16} aria-hidden="true" />}
                      onClick={() => {
                        const reason = window.prompt(`Remove “${w.title}” from the feed? Give a reason for the authors (optional).`);
                        if (reason !== null) removeWork.mutate({ id: w.id, remove: true, reason }, { onSuccess: () => toast('Removed from the feed.') });
                      }}
                    >
                      Remove
                    </Button>
                  )
                }
              >
                <span className={styles.badges}>
                  <TypeTag type={w.type} />
                  {w.removedAt && <Badge tone="bad">Removed {relTime(w.removedAt)}</Badge>}
                </span>
                <Link to={`/works/${w.id}`} className={styles.title}>
                  {w.title}
                </Link>
                <span className={styles.meta}>
                  {w.authors.map((a) => a.name).join(', ')} · {w.commentCount} comments
                </span>
              </Row>
            ))}
          </ul>
        )}
      </Sheet>
      <Sheet title="Opportunities" aside={String(data.opportunities.length)} flush>
        {data.opportunities.length === 0 ? (
          <SheetEmpty>No opportunities posted.</SheetEmpty>
        ) : (
          <ul className={styles.list}>
            {data.opportunities.map((o) => (
              <Row
                key={o.id}
                actions={
                  <Button variant="danger" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => window.confirm(`Delete “${o.title}”?`) && delOpp.mutate(o.id, { onSuccess: () => toast('Opportunity removed.') })}>
                    Delete
                  </Button>
                }
              >
                <span className={styles.title}>{o.title}</span>
                <span className={styles.meta}>
                  {o.adviser.name} · {relTime(o.createdAt)}
                </span>
              </Row>
            ))}
          </ul>
        )}
      </Sheet>
      <Sheet title="Recent comments" aside={String(data.comments.length)} flush>
        {data.comments.length === 0 ? (
          <SheetEmpty>No public comments.</SheetEmpty>
        ) : (
          <ul className={styles.list}>
            {data.comments.map((c) => (
              <Row
                key={c.id}
                actions={
                  <Button
                    variant="danger"
                    icon={<Trash2 size={16} aria-hidden="true" />}
                    onClick={() => window.confirm('Delete this comment?') && delComment.mutate({ id: c.work.id, commentId: c.id }, { onSuccess: () => toast('Comment deleted.') })}
                  >
                    Delete
                  </Button>
                }
              >
                <span className={styles.meta}>
                  {c.author.name} on <Link to={`/works/${c.work.id}#discussion`}>{c.work.title}</Link> · {relTime(c.createdAt)}
                </span>
                <p className={styles.description}>{c.text}</p>
              </Row>
            ))}
          </ul>
        )}
      </Sheet>
    </div>
  );
}
