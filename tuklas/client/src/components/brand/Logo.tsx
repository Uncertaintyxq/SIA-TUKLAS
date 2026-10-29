/**
 * Logo — the Tuklas wordmark with its letter badge.
 * Pass `inverse` on dark backgrounds.
 */
import clsx from 'clsx';
import styles from './Logo.module.css';

export function Logo({ className, inverse = false }: { className?: string; inverse?: boolean }) {
  return (
    <span className={clsx(styles.logo, inverse && styles.inverse, className)}>
      <span className={styles.badge} aria-hidden="true">
        T
      </span>
      <span>Tuklas</span>
    </span>
  );
}
