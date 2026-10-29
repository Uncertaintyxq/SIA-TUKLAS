/**
 * ApprovalLine — who approved a published work, and when.
 * A plain record (icon, approver, date) that replaced the signature seal.
 */
import clsx from 'clsx';
import { BadgeCheck } from 'lucide-react';
import type { Approval } from '@server/schemas/works';
import { fmtDate, isoDate } from '../../lib/format';
import styles from './ApprovalLine.module.css';

/** "Dr. Maria Santos" or "Lea Mercado · Academic Panel" */
export const approverLabel = (a: Approval) => (a.approverRole === 'admin' ? `${a.approverName} · Academic Panel` : a.approverName);

export function ApprovalLine({ approval, className }: { approval: Approval; className?: string }) {
  return (
    <p className={clsx(styles.line, className)}>
      <BadgeCheck size={18} aria-hidden="true" className={styles.icon} />
      <span className={styles.text}>
        Approved by <span className={styles.who}>{approverLabel(approval)}</span>
      </span>
      <time className={styles.date} dateTime={approval.approvedAt} title={fmtDate(approval.approvedAt)}>
        {isoDate(approval.approvedAt)}
      </time>
    </p>
  );
}
