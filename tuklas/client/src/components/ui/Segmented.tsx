/**
 * Segmented — a segmented control for choosing one of a few options, with optional icons.
 */
import { useId, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import styles from './Segmented.module.css';

interface SegmentedProps<T extends string> {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (value: T) => void;
}

/** Radio group with a sliding selection marker. */
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  const group = useId();
  return (
    <div className={styles.group} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            className={styles.option}
            onClick={() => onChange(o.value)}
          >
            {on && (
              <motion.span
                layoutId={`${group}-marker`}
                className={styles.marker}
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className={styles.content}>
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
