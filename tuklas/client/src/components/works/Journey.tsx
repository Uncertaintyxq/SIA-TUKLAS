/**
 * Journey — the step indicator that shows a work's approval status.
 */
import clsx from 'clsx';
import { Check, X } from 'lucide-react';
import type { WorkStatus } from '../../types/works';
import styles from './Journey.module.css';

const position: Record<WorkStatus, number> = { draft: 0, submitted: 1, under_review: 2, revision: 2, approved: 3, rejected: 3 };

/** Where a work sits on its way from draft to public: Draft → Submitted → Under review → Approved. */
export function Journey({ status }: { status: WorkStatus }) {
  const at = position[status];
  const steps = [
    { label: 'Draft' },
    { label: 'Submitted' },
    { label: status === 'revision' ? 'Needs revision' : 'Under review', tone: status === 'revision' ? 'warn' : undefined },
    { label: status === 'rejected' ? 'Not approved' : 'Approved & public', tone: status === 'rejected' ? 'bad' : status === 'approved' ? 'ok' : undefined },
  ];
  return (
    <ol className={styles.journey} aria-label="Approval journey">
      {steps.map((s, i) => {
        const state = i < at || (i === at && status === 'approved') ? 'done' : i === at ? 'current' : 'todo';
        return (
          <li key={i} className={clsx(styles.step, styles[state], s.tone && styles[s.tone])} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={styles.dot} aria-hidden="true">
              {state === 'done' && <Check size={13} strokeWidth={3} />}
              {status === 'rejected' && i === 3 && <X size={13} strokeWidth={3} />}
            </span>
            <span className={styles.label}>{s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
