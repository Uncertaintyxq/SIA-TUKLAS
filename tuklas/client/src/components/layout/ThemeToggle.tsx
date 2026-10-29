/**
 * ThemeToggle — one-tap switch between light and dark mode, in the header.
 * "Auto" (follow the system) stays available in the account menu.
 */
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Moon, Sun } from 'lucide-react';
import { usePrefs } from '../../lib/prefs';
import styles from './ThemeToggle.module.css';

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setPrefs } = usePrefs();
  const reduce = useReducedMotion();
  const dark = resolvedTheme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <button type="button" className={clsx(styles.toggle, className)} onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })} aria-label={label} title={label}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={resolvedTheme}
          className={styles.icon}
          initial={reduce ? { opacity: 0 } : { opacity: 0, rotate: -90, scale: 0.6 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, rotate: 0, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, rotate: 90, scale: 0.6 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        >
          {dark ? <Sun size={19} aria-hidden="true" /> : <Moon size={19} aria-hidden="true" />}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
