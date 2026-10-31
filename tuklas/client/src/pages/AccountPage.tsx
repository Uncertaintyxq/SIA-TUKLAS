/**
 * AccountPage — "/account": sign-in security and privacy. Change the password, turn two-factor
 * sign-in on or off, see where the account is signed in, and download your data.
 */
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Download, Monitor, ShieldCheck, ShieldOff } from 'lucide-react';
import type { PublicUser } from '../types/auth';
import { useMe } from '../api/auth';
import { EXPORT_URL, useChangePassword, useDisableTwoFactor, useLogoutOthers, useRecoveryCodes, useRegenerateRecoveryCodes, useSessions } from '../api/account';
import { PasswordConfirm } from '../components/account/PasswordConfirm';
import { PRIVACY_VERSION } from '../components/account/PrivacyNotice';
import { RecoveryCodes } from '../components/account/RecoveryCodes';
import { TwoFactorSetup } from '../components/account/TwoFactorSetup';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { relTime } from '../lib/format';
import styles from '../components/account/Account.module.css';

export function AccountPage() {
  const { data: me } = useMe();
  if (!me) return null;
  return (
    <>
      <PageHeader title="Account and security" description={<>Signed in as <strong>{me.email}</strong></>} />
      <div className={styles.sections}>
        <TwoFactorSection me={me} />
        <PasswordSection />
        <SessionsSection />
        <DataSection />
      </div>
    </>
  );
}

function TwoFactorSection({ me }: { me: PublicUser }) {
  const [mode, setMode] = useState<'idle' | 'setup' | 'codes' | 'off'>('idle');
  const toast = useToast();
  const codes = useRecoveryCodes(mode === 'codes');
  const regenerate = useRegenerateRecoveryCodes();
  const disable = useDisableTwoFactor();
  const close = () => setMode('idle');

  return (
    <Sheet title="Two-factor sign-in">
      <div className={styles.status}>
        {me.twoFactorEnabled ? (
          <Badge tone="ok" icon={<ShieldCheck size={14} aria-hidden="true" />}>On</Badge>
        ) : (
          <Badge tone="warn" icon={<ShieldOff size={14} aria-hidden="true" />}>Off</Badge>
        )}
        <span className={styles.muted}>
          {me.role === 'student' ? 'Recommended: a code from your phone is needed to log in, as well as your password.' : 'Required for educator and admin accounts.'}
        </span>
      </div>

      {!me.twoFactorEnabled &&
        (mode === 'setup' ? (
          <TwoFactorSetup
            onCancel={close}
            onDone={() => {
              close();
              toast('Two-factor sign-in is on.', 'success');
            }}
          />
        ) : (
          <Button variant="primary" onClick={() => setMode('setup')}>
            Set up two-factor sign-in
          </Button>
        ))}

      {me.twoFactorEnabled && mode === 'idle' && (
        <div className={styles.actions}>
          <Button onClick={() => setMode('codes')}>Show recovery codes</Button>
          {me.role === 'student' && (
            <Button variant="danger" onClick={() => setMode('off')}>
              Turn off
            </Button>
          )}
        </div>
      )}

      {me.twoFactorEnabled && mode === 'codes' && (
        <PasswordConfirm reason="Enter your password to see your recovery codes.">
          <div className={styles.form}>
            <p className={styles.muted}>Each code logs you in once if you lose your phone. Making new codes stops the old ones from working.</p>
            {codes.data ? <RecoveryCodes codes={codes.data} /> : <Skeleton />}
            <div className={styles.actions}>
              <Button loading={regenerate.isPending} onClick={() => regenerate.mutate(undefined, { onSuccess: () => toast('New recovery codes made. The old ones no longer work.', 'success') })}>
                Make new codes
              </Button>
              <Button variant="ghost" onClick={close}>
                Done
              </Button>
            </div>
          </div>
        </PasswordConfirm>
      )}

      {me.twoFactorEnabled && mode === 'off' && (
        <PasswordConfirm reason="Enter your password to turn off two-factor sign-in.">
          <div className={styles.form}>
            <p>Without it, your password alone opens your account.</p>
            {disable.error && (
              <p className={styles.error} role="alert">
                {disable.error.message}
              </p>
            )}
            <div className={styles.actions}>
              <Button variant="danger" loading={disable.isPending} onClick={() => disable.mutate(undefined, { onSuccess: () => { close(); toast('Two-factor sign-in is off.', 'info'); } })}>
                Turn off two-factor sign-in
              </Button>
              <Button onClick={close}>Cancel</Button>
            </div>
          </div>
        </PasswordConfirm>
      )}
    </Sheet>
  );
}

const blankPassword = { current_password: '', password: '', password_confirmation: '' };

function PasswordSection() {
  const change = useChangePassword();
  const toast = useToast();
  const [form, setForm] = useState(blankPassword);
  const set = (k: keyof typeof blankPassword) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const mismatch = form.password_confirmation !== '' && form.password_confirmation !== form.password;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    change.mutate(form, {
      onSuccess: () => {
        setForm(blankPassword);
        toast('Password changed.', 'success');
      },
    });
  };

  return (
    <Sheet title="Password">
      <form className={styles.form} onSubmit={submit}>
        <TextField label="Current password" type="password" autoComplete="current-password" value={form.current_password} onChange={set('current_password')} required />
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters. A short phrase is easy to remember."
          value={form.password}
          onChange={set('password')}
          required
          minLength={12}
        />
        <TextField
          label="New password again"
          type="password"
          autoComplete="new-password"
          value={form.password_confirmation}
          onChange={set('password_confirmation')}
          error={mismatch ? 'The two passwords don’t match.' : undefined}
          required
        />
        {change.error && (
          <p className={styles.error} role="alert">
            {change.error.message}
          </p>
        )}
        <div className={styles.actions}>
          <Button type="submit" variant="primary" loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** "Chrome on Windows", from a user-agent string. Good enough to recognise your own devices. */
function deviceLabel(ua: string) {
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : null;
  const os = /Windows/.test(ua) ? 'Windows' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Mac OS X/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : null;
  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? 'Unknown browser';
}

function SessionsSection() {
  const sessions = useSessions();
  const logoutOthers = useLogoutOthers();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const others = (sessions.data ?? []).filter((s) => !s.current).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    logoutOthers.mutate(password, {
      onSuccess: () => {
        setPassword('');
        toast('Signed out of every other browser.', 'success');
      },
    });
  };

  return (
    <Sheet title="Where you’re signed in">
      {sessions.isPending ? (
        <Skeleton />
      ) : sessions.error ? (
        <p className={styles.error} role="alert">
          {sessions.error.message}
        </p>
      ) : sessions.data.length === 0 ? (
        <SheetEmpty>No sessions found.</SheetEmpty>
      ) : (
        <ul className={styles.sessions}>
          {sessions.data.map((s) => (
            <li key={s.id} className={styles.session}>
              <span className={styles.sessionHead}>
                <Monitor size={16} aria-hidden="true" />
                {deviceLabel(s.userAgent)}
                {s.current && <Badge tone="ok">This browser</Badge>}
              </span>
              <span className={styles.muted}>
                {s.ipAddress ?? 'Unknown address'} · active {relTime(s.lastActiveAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {others > 0 && (
        <form className={styles.form} onSubmit={submit}>
          <p className={styles.muted}>Don’t recognise one, or used a shared computer? Sign out everywhere else, then change your password.</p>
          <TextField label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          {logoutOthers.error && (
            <p className={styles.error} role="alert">
              {logoutOthers.error.message}
            </p>
          )}
          <div className={styles.actions}>
            <Button type="submit" loading={logoutOthers.isPending}>
              Sign out other browsers
            </Button>
          </div>
        </form>
      )}
    </Sheet>
  );
}

function DataSection() {
  return (
    <Sheet title="Your data">
      <div className={styles.form}>
        <p>
          You accepted the <Link to="/privacy">privacy notice</Link> (version {PRIVACY_VERSION}). You can download everything Tuklas holds about you as a
          JSON file: your account, portfolio, works, comments, messages, registrations, notifications and sign-in activity.
        </p>
        <div className={styles.actions}>
          <a className={styles.link} href={EXPORT_URL} download>
            <Download size={16} aria-hidden="true" /> Download my data
          </a>
        </div>
        <p className={styles.muted}>Deleting your account is coming soon. Until then, ask the Office of Research.</p>
      </div>
    </Sheet>
  );
}
