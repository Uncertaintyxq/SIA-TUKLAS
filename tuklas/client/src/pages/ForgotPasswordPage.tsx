/**
 * ForgotPasswordPage — "/forgot-password": asks for the email and sends a reset link.
 * The answer is the same whether or not the email has an account.
 */
import { useState, type FormEvent } from 'react';
import { useForgotPassword } from '../api/account';
import { SetupFrame } from '../components/account/SetupFrame';
import { Button, ButtonLink } from '../components/ui/Button';
import { TextField } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import styles from '../components/account/Account.module.css';

export function ForgotPasswordPage() {
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    forgot.mutate(email);
  };

  return (
    <SetupFrame title="Reset your password" sub="Enter your school email and we’ll send you a link to choose a new password.">
      {forgot.data ? (
        <Notice tone="info">{forgot.data.status} The link works for 60 minutes.</Notice>
      ) : (
        <form className={styles.form} onSubmit={submit}>
          <TextField label="School email" type="email" autoComplete="email" placeholder="you@tuklas.edu" value={email} onChange={(e) => setEmail(e.target.value)} required />
          {forgot.error && (
            <p className={styles.error} role="alert">
              {forgot.error.message}
            </p>
          )}
          <Button type="submit" variant="primary" size="lg" block loading={forgot.isPending}>
            Send reset link
          </Button>
        </form>
      )}
      <ButtonLink to="/login" variant="ghost">
        Back to log in
      </ButtonLink>
    </SetupFrame>
  );
}
