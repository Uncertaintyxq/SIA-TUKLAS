/**
 * Switch — an on/off control for a setting that takes effect immediately (a native checkbox with role="switch").
 */
import { useId, type ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Switch.module.css';

export function Switch({
  label,
  checked,
  onChange,
  disabled,
  hint,
  className,
}: {
  label: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <label className={clsx(styles.switch, disabled && styles.disabled, className)} htmlFor={id}>
      <input id={id} type="checkbox" role="switch" className={styles.input} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.track} aria-hidden="true">
        <span className={styles.thumb} />
      </span>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {hint && <span className={styles.hint}>{hint}</span>}
      </span>
    </label>
  );
}
