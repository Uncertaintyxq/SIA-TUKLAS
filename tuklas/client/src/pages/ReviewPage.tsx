/**
 * ReviewPage — the "/review" board where advisers see works sent to them, grouped by review status.
 * Open to educators and admins only.
 */
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { ListChecks, ShieldAlert, Users } from 'lucide-react';
import type { WorkStatus } from '@server/schemas/works';
import { useMe } from '../api/auth';
import { useReviewQueue, type MyWork } from '../api/works';
import { PageHeader } from '../components/layout/PageHeader';
import { TypeTag } from '../components/works/WorkBadges';
import { Badge } from '../components/ui/Badge';
import { ButtonLink } from '../components/ui/Button';
import { Notice } from '../components/ui/Notice';
import { Skeleton } from '../components/ui/Skeleton';
import { plural, relTime } from '../lib/format';
import styles from './ReviewPage.module.css';

const columns: { status: WorkStatus; label: string; hint: string }[] = [
  { status: 'submitted', label: 'Awaiting review', hint: 'New and resubmitted work' },
  { status: 'under_review', label: 'Under review', hint: 'You’ve started reading' },
  { status: 'revision', label: 'Needs revision', hint: 'Back with the author' },
  { status: 'approved', label: 'Approved & signed', hint: 'Public on the feed' },
];

export function ReviewPage() {
  const { data: me } = useMe();
  const { data: works, isPending } = useReviewQueue();
  const rejected = works?.filter((w) => w.status === 'rejected').length ?? 0;

  return (
    <>
      <PageHeader
        title="Review board"
        description="Comment, request revisions and sign off on your advisees’ work. Approval publishes it to their portfolio and the feed."
        actions={
          <ButtonLink to="/groups" icon={<Users size={18} aria-hidden="true" />}>
            Research groups
          </ButtonLink>
        }
      />
      {me?.role === 'educator' && !me.verified && (
        <Notice tone="warn" icon={<ShieldAlert size={18} aria-hidden="true" />} className={styles.notice}>
          <strong>Your educator account isn’t verified yet.</strong> An admin from the Office of Research will confirm it; until then you can read submissions but not approve them, and students can’t choose you as their adviser.
        </Notice>
      )}
      <div className={styles.board}>
        {columns.map((c) => {
          const list = works?.filter((w) => w.status === c.status) ?? [];
          return (
            <section key={c.status} className={clsx(styles.column, styles[c.status])} aria-labelledby={`col-${c.status}`}>
              <header className={styles.colHead}>
                <span className={styles.dot} aria-hidden="true" />
                <h2 id={`col-${c.status}`} className={styles.colTitle}>
                  {c.label}
                </h2>
                <span className={styles.count}>{list.length}</span>
              </header>
              <p className={styles.colHint}>{c.hint}</p>
              <div className={styles.cards}>
                {isPending ? <Skeleton className={styles.skeleton} /> : list.length === 0 ? <p className={styles.none}>Nothing here.</p> : list.map((w) => <Card key={w.id} work={w} />)}
              </div>
            </section>
          );
        })}
      </div>
      {rejected > 0 && <p className={styles.footnote}>{plural(rejected, 'work')} marked not approved are hidden from the board.</p>}
    </>
  );
}

function Card({ work: w }: { work: MyWork }) {
  return (
    <Link to={`/works/${w.id}`} className={styles.card}>
      <span className={styles.cardTop}>
        <TypeTag type={w.type} />
        {w.versionCount > 1 && <Badge tone="neutral">v{w.versionCount}</Badge>}
      </span>
      <span className={styles.cardTitle}>{w.title}</span>
      <span className={styles.cardMeta}>
        <span>{w.authors.map((a) => a.name).join(', ')}</span>
        <time dateTime={w.updatedAt}>{relTime(w.approvedAt ?? w.submittedAt ?? w.updatedAt)}</time>
      </span>
      {w.openItems > 0 && (
        <Badge tone="warn" icon={<ListChecks size={13} aria-hidden="true" />}>
          {plural(w.openItems, 'fix')} to confirm
        </Badge>
      )}
    </Link>
  );
}
