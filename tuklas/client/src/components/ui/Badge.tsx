/**
 * Badge — a small colored label for statuses, roles and kinds.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Badge.module.css';

export type BadgeTone = 'neutral' | 'purple' | 'blue' | 'gold' | 'ok' | 'warn' | 'bad';

export function Badge({ tone = 'neutral', icon, children, className }: { tone?: BadgeTone; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <span className={clsx(styles.badge, styles[tone], className)}>
      {icon}
      {children}
    </span>
  );
}
