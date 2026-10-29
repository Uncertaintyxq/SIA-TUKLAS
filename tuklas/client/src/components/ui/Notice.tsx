/**
 * Notice — an inline callout for rules and warnings in tones info, gold, warn and bad.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Notice.module.css';

/** An inline note: a rule and a tint, for rules the reader should know ("Quality first"). */
export function Notice({ tone = 'info', icon, children, className }: { tone?: 'info' | 'gold' | 'warn' | 'bad'; icon?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={clsx(styles.notice, styles[tone], className)} role={tone === 'bad' ? 'alert' : undefined}>
      {icon && <span className={styles.icon}>{icon}</span>}
      <div className={styles.text}>{children}</div>
    </div>
  );
}
