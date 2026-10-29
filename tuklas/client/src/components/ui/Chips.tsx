/**
 * Chips — a row of toggle chips for picking one filter, with optional counts.
 */
import { useId } from 'react';
import { motion } from 'framer-motion';
import styles from './Chips.module.css';

interface ChipsProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
}

/** Filter chips with a sliding marker, like the index tabs. Scrolls sideways on narrow screens. */
export function Chips<T extends string>({ label, value, options, onChange }: ChipsProps<T>) {
  const group = useId();
  return (
    <div className={styles.chips} role="group" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" className={styles.chip} aria-pressed={on} onClick={() => onChange(o.value)}>
            {on && <motion.span layoutId={`${group}-chip`} className={styles.marker} transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
            <span className={styles.label}>
              {o.label}
              {o.count !== undefined && <span className={styles.count}>{o.count}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
