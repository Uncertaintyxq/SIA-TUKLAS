/**
 * ResetPasswordPage — "/reset-password?token=…&email=…", opened from the emailed link:
 * choose a new password, then log in with it.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useResetPassword } from '../api/account';
import { ApiError } from '../api/client';
import { SetupFrame } from '../components/account/SetupFrame';
import { Button, ButtonLink } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { useToast } from '../components/ui/Toast';
import styles from '../components/account/Account.module.css';

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const email = params.get('email') ?? '';
  const reset = useResetPassword();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [again, setAgain] = useState('');
  const mismatch = again !== '' && again !== password;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mismatch) return;
    reset.mutate(
      { token, email, password, password_confirmation: again },
      {
        onSuccess: () => {
          toast('Password changed. Log in with your new password.', 'success');
          navigate('/login', { replace: true });
        },
      },
    );
  };

  if (!token || !email)
    return (
      <SetupFrame title="This reset link is incomplete" sub="Open the link from the email again, or ask for a new one.">
        <ButtonLink to="/forgot-password" variant="primary">
          Ask for a new link
        </ButtonLink>
      </SetupFrame>
    );

  return (
    <SetupFrame title="Choose a new password" sub={<>For <strong>{email}</strong></>}>
      <form className={styles.form} onSubmit={submit}>
        <TextField
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters. A short phrase is easy to remember."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={12}
        />
        <TextField
          label="New password again"
          type="password"
          autoComplete="new-password"
          value={again}
          onChange={(e) => setAgain(e.target.value)}
          error={mismatch ? 'The two passwords don’t match.' : undefined}
          required
        />
        {reset.error && (
          <Notice tone="bad">
            {reset.error.message}{' '}
            {reset.error instanceof ApiError && reset.error.issues?.email && (
              <>
                Links work once and for 60 minutes. <ButtonLink to="/forgot-password" variant="ghost">Ask for a new link</ButtonLink>
              </>
            )}
          </Notice>
        )}
        <Button type="submit" variant="primary" size="lg" block loading={reset.isPending}>
          Change password
        </Button>
      </form>
    </SetupFrame>
  );
}
