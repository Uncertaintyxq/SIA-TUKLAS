/**
 * LoginPage — the sign-in page with the cover panel and sign-up link ("/login").
 * Signed-in users are sent back to where they came from; demo mode adds one-click role logins.
 */
import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BadgeCheck, GraduationCap, ShieldCheck } from 'lucide-react';
import { useLogin, useMe } from '../api/auth';
import { firstName } from '../lib/format';
import { Logo } from '../components/brand/Logo';
import { Tuko } from '../components/brand/Tuko';
import { Button } from '../components/ui/Button';
import { ApprovalLine } from '../components/works/ApprovalLine';
import { TextField } from '../components/ui/Field';
import { useToast } from '../components/ui/Toast';
import { SignupModal } from './SignupModal';
import styles from './LoginPage.module.css';

const demoMode = import.meta.env.VITE_DEMO_LOGIN !== 'false';
const DEMO_PASSWORD = 'tuklas123';
const demoAccounts = [
  { role: 'Student', email: 'andrea@tuklas.edu', icon: GraduationCap, variant: 'secondary' },
  { role: 'Educator', email: 'msantos@tuklas.edu', icon: BadgeCheck, variant: 'secondary' },
  { role: 'Admin', email: 'admin@tuklas.edu', icon: ShieldCheck, variant: 'ink' },
] as const;

const specimenApproval = { approverName: 'Dr. Maria Santos', approverRole: 'educator', approvedAt: new Date(Date.now() - 12 * 86_400_000).toISOString() } as const;

export function LoginPage() {
  const { data: me } = useMe();
  const login = useLogin();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const reduce = useReducedMotion();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [signupOpen, setSignupOpen] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/feed';
  if (me) return <Navigate to={from} replace />;

  const signIn = (creds: { email: string; password: string }) =>
    login.mutate(creds, {
      onSuccess: ({ user }) => {
        // The code screen comes with feat/client-account-screens. Demo mode skips 2FA.
        if (!user) return toast('This account uses two-factor sign-in. Code entry isn’t available in this version yet.', 'info');
        toast(`Welcome back, ${firstName(user.name)}.`, 'success');
        navigate(from, { replace: true });
      },
    });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    signIn({ email, password });
  };

  const rise = (delay: number) =>
    reduce ? {} : { initial: { opacity: 0, y: 18 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.6, ease: [0.16, 1, 0.3, 1] as const } };

  return (
    <main className={styles.login}>
      <section className={styles.cover}>
        <motion.div {...rise(0)}>
          <Logo inverse />
        </motion.div>
        <motion.h1 className={styles.headline} {...rise(0.06)}>
          From Defense to Discovery
        </motion.h1>
        <motion.p className={styles.lede} {...rise(0.12)}>
          A research and academic engagement hub for students, educators and administrators. Every public work is approved by a research adviser or the academic panel.
        </motion.p>
        <motion.span className={styles.pill} {...rise(0.18)}>
          Academic engagement hub
        </motion.span>

        <motion.figure className={styles.specimen} {...rise(0.3)} aria-label="Example of an approved entry">
          <Tuko size={84} className={styles.peek} />
          <div className={styles.entryHead}>
            <span className={styles.entryNo}>No. 001</span>
            <span className={styles.tag}>Research</span>
          </div>
          <p className={styles.entryTitle}>Offline-First Flood Alert Mesh for Barangay Responders</p>
          <p className={styles.entryBy}>Andrea Villanueva · BS Computer Science</p>
          <ApprovalLine approval={specimenApproval} className={styles.entryFoot} />
        </motion.figure>
      </section>

      <section className={styles.formSide}>
        <motion.div className={styles.card} {...rise(0.1)}>
          <h2 className={styles.welcome}>Welcome back</h2>
          <p className={styles.sub}>Log in to continue to your workspace.</p>

          <form className={styles.form} onSubmit={submit} noValidate>
            <TextField
              label="Email address"
              type="email"
              autoComplete="username"
              placeholder="you@tuklas.edu"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <TextField
              label="Password"
              type="password"
              autoComplete="current-password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {login.error && (
              <p className={styles.error} role="alert">
                {login.error.message}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" block loading={login.isPending}>
              Log in
            </Button>
          </form>

          {demoMode && (
            <>
              <div className={styles.divider}>Continue as</div>
              <div className={styles.roles}>
                {demoAccounts.map((a) => (
                  <Button
                    key={a.role}
                    variant={a.variant}
                    icon={<a.icon size={18} aria-hidden="true" />}
                    disabled={login.isPending}
                    onClick={() => signIn({ email: a.email, password: DEMO_PASSWORD })}
                  >
                    {a.role}
                  </Button>
                ))}
              </div>
            </>
          )}

          <p className={styles.create}>
            New to Tuklas?{' '}
            <button type="button" className={styles.link} onClick={() => setSignupOpen(true)}>
              Create your account
            </button>
          </p>
        </motion.div>
      </section>

      <SignupModal open={signupOpen} onClose={() => setSignupOpen(false)} />
    </main>
  );
}
