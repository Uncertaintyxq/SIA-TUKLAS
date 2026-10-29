/**
 * EducatorMonitor — the admin's view of every educator: what they've published, posted and reviewed,
 * when they were last on Tuklas, and switches to grant or revoke each educator right. Below it,
 * a feed of the latest educator activity.
 */
import { Link } from 'react-router-dom';
import { BookOpen, ClipboardCheck, Megaphone, Users } from 'lucide-react';
import { useAdminEducators, usePatchUser, type EducatorOverview } from '../../api/admin';
import { relTime } from '../../lib/format';
import { PresenceLine } from '../chat/Presence';
import { Person } from '../people/Person';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { Sheet, SheetEmpty } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import { Switch } from '../ui/Switch';
import { useToast } from '../ui/Toast';
import styles from './EducatorMonitor.module.css';

const rights = [
  { key: 'publish', field: 'canPublish', label: 'Publish research', hint: 'Internal and Public' },
  { key: 'moderateGroups', field: 'canModerateGroups', label: 'Moderate groups', hint: 'Members, roles, chat' },
  { key: 'broadcast', field: 'canBroadcast', label: 'Post announcements', hint: 'Department and group' },
] as const;

const kindIcon = { publication: BookOpen, announcement: Megaphone, review: ClipboardCheck, group: Users } as const;

export function EducatorMonitor() {
  const { data, isPending } = useAdminEducators(true);
  if (isPending || !data) return <Skeleton className={styles.loading} />;
  return (
    <>
      <Sheet title="Educator rights & activity" aside={String(data.educators.length)} flush>
        {data.educators.length === 0 ? (
          <SheetEmpty>No educator accounts yet. Make someone an educator under Users &amp; roles.</SheetEmpty>
        ) : (
          <ul className={styles.list}>
            {data.educators.map((e) => (
              <EducatorRow key={e.id} educator={e} />
            ))}
          </ul>
        )}
      </Sheet>

      <Sheet title="Recent educator activity" flush>
        {data.recent.length === 0 ? (
          <SheetEmpty>Publications, announcements, reviews and new groups will show up here.</SheetEmpty>
        ) : (
          <ol className={styles.feed}>
            {data.recent.map((a) => {
              const Icon = kindIcon[a.kind];
              return (
                <li key={a.key} className={styles.event}>
                  <Avatar name={a.educator.name} role={a.educator.role} photo={a.educator.photoUrl} size="sm" />
                  <span className={styles.eventText}>
                    <strong>{a.educator.name}</strong> <Link to={a.link}>{a.text}</Link>
                  </span>
                  <Icon size={16} aria-hidden="true" className={styles.eventIcon} />
                  <time className={styles.when} dateTime={a.at}>
                    {relTime(a.at)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
      </Sheet>
    </>
  );
}

function EducatorRow({ educator: e }: { educator: EducatorOverview }) {
  const patch = usePatchUser();
  const toast = useToast();
  const p = e.counts.publications;
  return (
    <li className={styles.row}>
      <div className={styles.who}>
        <Person user={e} sub={e.email} />
        <span className={styles.status}>
          {e.verified ? <PresenceLine person={e} /> : <Badge tone="gold">Waiting for verification</Badge>}
        </span>
      </div>
      <dl className={styles.counts}>
        <div>
          <dt>Research</dt>
          <dd>
            {p.public} public · {p.internal} internal · {p.draft} {p.draft === 1 ? 'draft' : 'drafts'}
          </dd>
        </div>
        <div>
          <dt>Groups</dt>
          <dd>{e.counts.groups}</dd>
        </div>
        <div>
          <dt>Announcements</dt>
          <dd>{e.counts.announcements}</dd>
        </div>
        <div>
          <dt>Reviews</dt>
          <dd>{e.counts.reviews}</dd>
        </div>
      </dl>
      <div className={styles.rights} role="group" aria-label={`Rights for ${e.name}`}>
        {rights.map((r) => (
          <Switch
            key={r.key}
            label={r.label}
            hint={e.verified ? r.hint : 'After verification'}
            checked={e.rights[r.key]}
            disabled={patch.isPending}
            onChange={(on) =>
              patch.mutate(
                { id: e.id, [r.field]: on },
                {
                  onSuccess: () => toast(`${r.label} ${on ? 'granted to' : 'revoked from'} ${e.name}.`, 'success'),
                  onError: (err) => toast(err.message, 'error'),
                },
              )
            }
          />
        ))}
      </div>
    </li>
  );
}
