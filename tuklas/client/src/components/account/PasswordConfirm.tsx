/**
 * PasswordConfirm — asks for the password again before a sensitive change (2FA, recovery codes).
 * Shows its children once the password was confirmed in the last few hours.
 */
import { useState, type FormEvent, type ReactNode } from 'react';
import { useConfirmPassword, usePasswordConfirmed } from '../../api/account';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { Skeleton } from '../ui/Skeleton';
import styles from './Account.module.css';

export function PasswordConfirm({ reason, children }: { reason: string; children: ReactNode }) {
  const status = usePasswordConfirmed();
  const confirm = useConfirmPassword();
  const [password, setPassword] = useState('');

  if (status.isPending) return <Skeleton />;
  if (status.data) return children;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    confirm.mutate(password, { onSuccess: () => setPassword('') });
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <p className={styles.muted}>{reason}</p>
      <TextField label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      {confirm.error && (
        <p className={styles.error} role="alert">
          {confirm.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" loading={confirm.isPending}>
          Continue
        </Button>
      </div>
    </form>
  );
}
