/**
 * UserMenu — the account popover with theme, look, account security, demo reset and log out.
 * Used in the top bar and the tab rail; closes on outside click or Escape.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { LogOut, Monitor, Moon, RotateCcw, ShieldCheck, Sun } from 'lucide-react';
import { useLogout, useResetDemo, type PublicUser } from '../../api/auth';
import { usePrefs } from '../../lib/prefs';
import { roleLabel } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Segmented } from '../ui/Segmented';
import { useToast } from '../ui/Toast';
import styles from './UserMenu.module.css';

const demoMode = import.meta.env.VITE_DEMO_LOGIN !== 'false';

/** Account, theme and look controls in one vellum popover. */
export function UserMenu({
  user,
  placement = 'down',
  inRail = false,
}: {
  user: PublicUser;
  placement?: 'down' | 'up';
  /** In the tab rail, the name collapses with the rail on medium screens. */
  inRail?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { prefs, setPrefs } = usePrefs();
  const logout = useLogout();
  const reset = useResetDemo();
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const offset = placement === 'up' ? 8 : -8;

  return (
    <div className={clsx(styles.root, inRail && styles.inRail)} ref={root}>
      <button
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
      >
        <Avatar name={user.name} role={user.role} size="sm" />
        <span className={styles.who}>
          <span className={styles.name}>{user.name}</span>
          <span className={styles.role}>{roleLabel[user.role]}</span>
        </span>
        <span className="sr-only">Account and appearance</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            className={styles.panel}
            data-placement={placement}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: offset, scale: 0.97, filter: 'blur(4px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: offset / 2, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 460, damping: 34 }}
          >
            <div className={styles.section}>
              <span className={styles.heading}>Theme</span>
              <Segmented
                label="Theme"
                value={prefs.theme}
                onChange={(theme) => setPrefs({ theme })}
                options={[
                  { value: 'light', label: 'Light', icon: <Sun size={15} aria-hidden="true" /> },
                  { value: 'dark', label: 'Dark', icon: <Moon size={15} aria-hidden="true" /> },
                  { value: 'system', label: 'Auto', icon: <Monitor size={15} aria-hidden="true" /> },
                ]}
              />
            </div>
            <div className={styles.section}>
              <span className={styles.heading}>Look</span>
              <Segmented
                label="Look"
                value={prefs.appearance}
                onChange={(appearance) => setPrefs({ appearance })}
                options={[
                  { value: 'modern', label: 'Modern' },
                  { value: 'classic', label: 'Classic' },
                ]}
              />
            </div>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.item}
                onClick={() => {
                  setOpen(false);
                  navigate('/account');
                }}
              >
                <ShieldCheck size={18} aria-hidden="true" />
                Account and security
              </button>
              {demoMode && (
                <button
                  type="button"
                  className={styles.item}
                  disabled={reset.isPending}
                  onClick={() =>
                    reset.mutate(undefined, {
                      onSuccess: () => toast('Demo data restored.', 'success'),
                      onError: (e) => toast(e.message, 'error'),
                    })
                  }
                >
                  <RotateCcw size={18} aria-hidden="true" />
                  Reset demo data
                </button>
              )}
              <button
                type="button"
                className={styles.item}
                onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
              >
                <LogOut size={18} aria-hidden="true" />
                Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
