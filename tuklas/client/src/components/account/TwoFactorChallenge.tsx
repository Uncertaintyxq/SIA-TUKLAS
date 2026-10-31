/**
 * TwoFactorChallenge — the second step of logging in to an account with 2FA: a code from the
 * authenticator app, or one of the recovery codes.
 */
import { useState, type FormEvent } from 'react';
import type { PublicUser } from '../../types/auth';
import { useTwoFactorChallenge } from '../../api/account';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import styles from './Account.module.css';

export function TwoFactorChallenge({ onSignedIn, onCancel }: { onSignedIn: (user: PublicUser) => void; onCancel: () => void }) {
  const challenge = useTwoFactorChallenge();
  const [recovery, setRecovery] = useState(false);
  const [value, setValue] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const input = recovery ? { recovery_code: value.trim() } : { code: value.replace(/\s/g, '') };
    challenge.mutate(input, { onSuccess: ({ user }) => onSignedIn(user) });
  };

  const switchMode = () => {
    setRecovery((r) => !r);
    setValue('');
    challenge.reset();
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      <p className={styles.muted}>
        {recovery ? 'Enter one of the recovery codes you saved when you set up two-factor sign-in. Each code works once.' : 'Open your authenticator app and enter the 6-digit code for Tuklas.'}
      </p>
      {recovery ? (
        <TextField key="recovery" label="Recovery code" autoComplete="off" spellCheck={false} value={value} onChange={(e) => setValue(e.target.value)} required autoFocus />
      ) : (
        <TextField
          key="code"
          className={styles.code}
          label="6-digit code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={7}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          autoFocus
        />
      )}
      {challenge.error && (
        <p className={styles.error} role="alert">
          {challenge.error.message}
        </p>
      )}
      <Button type="submit" variant="primary" size="lg" block loading={challenge.isPending}>
        Log in
      </Button>
      <div className={styles.actions}>
        <button type="button" className={styles.link} onClick={switchMode}>
          {recovery ? 'Use the app code instead' : 'Lost your phone? Use a recovery code'}
        </button>
        <button type="button" className={styles.link} onClick={onCancel}>
          Back
        </button>
      </div>
    </form>
  );
}
