/**
 * Toast — short status messages that stack in the corner and dismiss themselves.
 * Wrap the app in ToastProvider, then call useToast() to show one; at most three show at a time.
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CircleAlert } from 'lucide-react';
import { Tuko } from '../brand/Tuko';
import styles from './Toast.module.css';

type Tone = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);
let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const reduce = useReducedMotion();

  const toast = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId++;
    setItems((list) => [...list.slice(-2), { id, message, tone }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3600);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className={styles.stack} aria-live="polite" aria-atomic="false">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout={!reduce}
              className={styles.toast}
              data-tone={t.tone}
              role={t.tone === 'error' ? 'alert' : 'status'}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.96, filter: 'blur(4px)' }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24, transition: { duration: 0.18 } }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              {t.tone === 'success' && <Tuko pose="cheer" size={36} className={styles.tuko} />}
              {t.tone === 'error' && <CircleAlert size={20} aria-hidden="true" className={styles.icon} />}
              <span>{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
