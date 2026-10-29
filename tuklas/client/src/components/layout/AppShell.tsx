/**
 * AppShell — the frame around every signed-in page.
 * Desktop: index-tab rail on the left, vellum header (search, theme toggle), the page with its notebook margin.
 * Phone: header on top, the page, and a bottom bar with the main destinations plus "More".
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import clsx from 'clsx';
import { Ellipsis, Search } from 'lucide-react';
import type { PublicUser } from '../../api/auth';
import { useAnnouncementsUnread } from '../../api/announcements';
import { useChatUnread } from '../../api/chat';
import { Logo } from '../brand/Logo';
import { navFor, type NavBadge, type NavItem } from './nav';
import { ThemeToggle } from './ThemeToggle';
import { UserMenu } from './UserMenu';
import styles from './AppShell.module.css';

export function AppShell({ user }: { user: PublicUser }) {
  const items = navFor(user.role);
  const location = useLocation();
  const reduce = useReducedMotion();
  const counts = useNavCounts(user);

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>

      <aside className={styles.rail} aria-label="Main navigation">
        <NavLink to="/feed" className={styles.brand} aria-label="Tuklas home">
          <Logo className={styles.railLogo} />
        </NavLink>
        <nav className={styles.tabs}>
          {items.map((item) => (
            <NavLink key={item.to} to={item.to} className={styles.tab}>
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="rail-tab"
                      className={styles.tabFill}
                      transition={{ type: 'spring', stiffness: 520, damping: 40 }}
                    />
                  )}
                  <item.icon className={styles.tabIcon} size={19} aria-hidden="true" />
                  <span className={styles.tabLabel}>{item.label}</span>
                  <Count value={item.badge ? counts[item.badge] : 0} className={styles.tabCount} />
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className={styles.railFoot}>
          <UserMenu user={user} placement="up" inRail />
        </div>
      </aside>

      <div className={styles.page}>
        <header className={styles.header}>
          <NavLink to="/feed" className={styles.headerBrand} aria-label="Tuklas home">
            <Logo />
          </NavLink>
          <HeaderSearch key={location.pathname} />
          <ThemeToggle className={styles.theme} />
          <div className={styles.headerUser}>
            <UserMenu user={user} placement="down" />
          </div>
        </header>

        <main id="main" className={styles.main} tabIndex={-1}>
          <div className={styles.margin} aria-hidden="true" />
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              className={styles.content}
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: 14, filter: 'blur(6px)' }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, filter: 'blur(3px)' }}
              transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            >
              <FrozenOutlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <BottomBar items={items} counts={counts} />
    </div>
  );
}

// ---------- Badges ----------

/** Unread messages and announcements for the nav. Admins have no direct messages. */
function useNavCounts(user: PublicUser): Record<NavBadge, number> {
  const chat = useChatUnread(user.role !== 'admin');
  const announcements = useAnnouncementsUnread(true);
  return { messages: chat.data?.messages ?? 0, announcements: announcements.data?.count ?? 0 };
}

function Count({ value, className }: { value: number; className?: string }) {
  if (value <= 0) return null;
  return (
    <span className={clsx(styles.count, className)}>
      {value > 99 ? '99+' : value}
      <span className="sr-only"> unread</span>
    </span>
  );
}

// ---------- Phone bottom bar ----------

function BottomBar({ items, counts }: { items: NavItem[]; counts: Record<NavBadge, number> }) {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const reduce = useReducedMotion();
  const panel = useRef<HTMLDivElement>(null);
  const primary = items.filter((i) => i.primary);
  const rest = items.filter((i) => !i.primary);
  const restActive = rest.some((i) => location.pathname.startsWith(i.to));
  const restCount = rest.reduce((n, i) => n + (i.badge ? counts[i.badge] : 0), 0);

  // Close "More" on navigation, Escape, or a tap outside it.
  useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!moreOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMoreOpen(false);
    const onDown = (e: PointerEvent) => !panel.current?.parentElement?.contains(e.target as Node) && setMoreOpen(false);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [moreOpen]);

  return (
    <nav className={styles.bottomBar} aria-label="Main navigation">
      {primary.map((item) => (
        <NavLink key={item.to} to={item.to} className={styles.barItem}>
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="bar-tab" className={styles.barFill} transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
              <span className={styles.barIconWrap}>
                <item.icon size={21} aria-hidden="true" className={styles.barIcon} />
                <Count value={item.badge ? counts[item.badge] : 0} className={styles.barCount} />
              </span>
              <span className={styles.barLabel}>{item.short}</span>
            </>
          )}
        </NavLink>
      ))}
      <button type="button" className={styles.barItem} aria-expanded={moreOpen} aria-controls="more-nav" onClick={() => setMoreOpen((o) => !o)} data-active={restActive || undefined}>
        {restActive && !moreOpen && <motion.span layoutId="bar-tab" className={styles.barFill} transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
        <span className={styles.barIconWrap}>
          <Ellipsis size={21} aria-hidden="true" className={styles.barIcon} />
          <Count value={restCount} className={styles.barCount} />
        </span>
        <span className={styles.barLabel}>More</span>
      </button>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            ref={panel}
            id="more-nav"
            className={styles.more}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 16, filter: 'blur(4px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
            transition={{ type: 'spring', stiffness: 460, damping: 36 }}
          >
            {rest.map((item) => (
              <NavLink key={item.to} to={item.to} className={styles.moreItem}>
                <item.icon size={20} aria-hidden="true" />
                <span>{item.label}</span>
                <Count value={item.badge ? counts[item.badge] : 0} className={styles.moreCount} />
              </NavLink>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

// ---------- Page plumbing ----------

/** Keeps the leaving page on screen while it animates out, instead of swapping to the next route mid-exit. */
function FrozenOutlet() {
  const outlet = useOutlet();
  const [frozen] = useState(outlet);
  return frozen;
}

function HeaderSearch() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    navigate(q.trim() ? `/feed?q=${encodeURIComponent(q.trim())}` : '/feed');
  };
  return (
    <form role="search" className={styles.search} onSubmit={submit}>
      <Search size={17} className={styles.searchIcon} aria-hidden="true" />
      <label className="sr-only" htmlFor="header-search">
        Search works, keywords and people
      </label>
      <input
        id="header-search"
        className={styles.searchInput}
        type="search"
        placeholder="Search works, keywords, people"
        value={q}
        onChange={(e) => setQ(e.target.value)}
      />
    </form>
  );
}
