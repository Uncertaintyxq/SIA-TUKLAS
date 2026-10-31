/**
 * SetupFrame — the plain card screen for steps outside the app: password reset, and the setup
 * an account must finish before Tuklas opens (email, 2FA, privacy). Signed in, it offers log out.
 */
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { useLogout } from '../../api/auth';
import { Logo } from '../brand/Logo';
import styles from './Account.module.css';

export function SetupFrame({
  title,
  sub,
  children,
  signedInAs,
  wide = false,
}: {
  title: string;
  sub?: ReactNode;
  children: ReactNode;
  /** The signed-in email, shown with a log-out link */
  signedInAs?: string;
  wide?: boolean;
}) {
  const logout = useLogout();
  const navigate = useNavigate();
  return (
    <main id="main" className={styles.frame}>
      <Link to="/login" className={styles.brand} aria-label="Tuklas">
        <Logo />
      </Link>
      <section className={clsx(styles.card, wide && styles.wide)}>
        <header>
          <h1 className={styles.title}>{title}</h1>
          {sub && <p className={styles.sub}>{sub}</p>}
        </header>
        {children}
        {signedInAs && (
          <footer className={styles.footer}>
            <span>Signed in as {signedInAs}</span>
            <button
              type="button"
              className={styles.link}
              disabled={logout.isPending}
              onClick={() => logout.mutate(undefined, { onSuccess: () => navigate('/login', { replace: true }) })}
            >
              Log out
            </button>
          </footer>
        )}
      </section>
    </main>
  );
}
