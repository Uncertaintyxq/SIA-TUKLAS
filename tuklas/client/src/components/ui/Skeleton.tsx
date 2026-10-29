/**
 * Skeleton — a loading placeholder shown while works, entries and lists load.
 */
import clsx from 'clsx';
import styles from './Skeleton.module.css';

/** A shimmering placeholder line or block while content loads. */
export function Skeleton({ className, round }: { className?: string; round?: boolean }) {
  return <span className={clsx(styles.skeleton, round && styles.round, className)} aria-hidden="true" />;
}
