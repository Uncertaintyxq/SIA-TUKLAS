/**
 * ReportQueue — the admins' Reports tab: each reported thing once, with every report about it.
 * Dismiss (nothing wrong), warn the person, or remove the content; every reporter hears the outcome.
 */
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CircleCheck, ExternalLink, Trash2 } from 'lucide-react';
import { useReportQueue, useResolveReport } from '../../api/reports';
import type { ReportAction, ReportItem } from '../../types/reports';
import { relTime } from '../../lib/format';
import { reportReasonLabel, reportTargetLabel } from '../../lib/labels';
import { Person } from '../people/Person';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Chips } from '../ui/Chips';
import { Sheet, SheetEmpty } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import styles from './ReportQueue.module.css';

export function ReportQueue() {
  const [status, setStatus] = useState<'open' | 'closed'>('open');
  const { data, isPending } = useReportQueue(status);

  return (
    <div className={styles.queue}>
      <Chips
        label="Reports"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'open', label: 'Waiting', count: data && status === 'open' ? data.openCount : undefined },
          { value: 'closed', label: 'Handled' },
        ]}
      />
      {isPending || !data ? (
        <Skeleton className={styles.skeleton} />
      ) : data.items.length === 0 ? (
        <Sheet title={status === 'open' ? 'Nothing waiting' : 'Nothing handled yet'}>
          <SheetEmpty>{status === 'open' ? 'No reports are waiting. People can report works, comments, messages, events and people.' : 'Handled reports appear here.'}</SheetEmpty>
        </Sheet>
      ) : (
        data.items.map((item) => <ReportCard key={item.key} item={item} />)
      )}
    </div>
  );
}

const outcome = (i: ReportItem) => (i.status === 'dismissed' ? 'Dismissed' : i.action === 'remove' ? 'Removed' : 'Warned');

function ReportCard({ item: i }: { item: ReportItem }) {
  const resolve = useResolveReport();
  const toast = useToast();
  const open = i.status === 'open';
  const canRemove = i.type !== 'user' && i.exists && !i.removed;

  const run = (action: ReportAction) => {
    let note: string | null = '';
    if (action === 'warn') note = window.prompt(`Warn ${i.owner?.name ?? 'them'}. What should they be told? (optional)`);
    if (action === 'remove') note = window.prompt(`Remove this ${reportTargetLabel[i.type].toLowerCase()}? Give a reason for the person (optional).`);
    if (note === null) return;
    resolve.mutate(
      { type: i.type, id: i.id, action, note },
      { onSuccess: () => toast(action === 'dismiss' ? 'Dismissed. The reporters were told.' : 'Done. The reporters were told.', 'success'), onError: (e) => toast(e.message, 'error') },
    );
  };

  return (
    <Sheet
      title={reportTargetLabel[i.type]}
      aside={`${i.reports.length} ${i.reports.length === 1 ? 'report' : 'reports'}`}
      actions={
        i.link && (
          <Link to={i.link} className={styles.open}>
            <ExternalLink size={15} aria-hidden="true" />
            Open
          </Link>
        )
      }
    >
      <div className={styles.card}>
        <div className={styles.subject}>
          {i.owner && <Person user={i.owner} size="sm" sub={i.type === 'user' ? 'Reported person' : 'Posted by'} />}
          <span className={styles.badges}>
            {i.removed && <Badge tone="bad">Taken down</Badge>}
            {!i.exists && !i.removed && <Badge>No longer there</Badge>}
            {!open && <Badge tone={i.status === 'dismissed' ? 'neutral' : 'warn'}>{outcome(i)}</Badge>}
          </span>
        </div>
        {i.type !== 'user' && <blockquote className={styles.snapshot}>{i.snapshot}</blockquote>}
        <ul className={styles.reports}>
          {i.reports.map((r) => (
            <li key={r.id} className={styles.report}>
              <span className={styles.reason}>{reportReasonLabel[r.reason]}</span>
              <span className={styles.meta}>
                {r.reporter.name} · {relTime(r.createdAt)}
              </span>
              {r.details && <p className={styles.details}>{r.details}</p>}
            </li>
          ))}
        </ul>
        {open ? (
          <div className={styles.actions}>
            <Button icon={<CircleCheck size={16} aria-hidden="true" />} onClick={() => run('dismiss')} disabled={resolve.isPending}>
              Dismiss
            </Button>
            {i.owner && (
              <Button icon={<AlertTriangle size={16} aria-hidden="true" />} onClick={() => run('warn')} disabled={resolve.isPending}>
                Warn {i.owner.name.split(' ')[0]}
              </Button>
            )}
            {canRemove && (
              <Button variant="danger" icon={<Trash2 size={16} aria-hidden="true" />} onClick={() => run('remove')} disabled={resolve.isPending}>
                Remove
              </Button>
            )}
          </div>
        ) : (
          <p className={styles.meta}>
            {outcome(i)} by {i.resolvedBy?.name ?? 'an admin'} {i.resolvedAt && relTime(i.resolvedAt)}
            {i.note && <>: “{i.note}”</>}
          </p>
        )}
      </div>
    </Sheet>
  );
}
