/**
 * TwoFactorSetup — turns on two-factor sign-in: confirm the password, scan the QR code into an
 * authenticator app, enter a code from it, then save the recovery codes.
 * The account only reports 2FA as on after the codes are saved, so the setup screen stays put until then.
 */
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirmTwoFactor, useEnableTwoFactor, useRecoveryCodes, useTwoFactorKey } from '../../api/account';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { Skeleton } from '../ui/Skeleton';
import { PasswordConfirm } from './PasswordConfirm';
import { RecoveryCodes } from './RecoveryCodes';
import styles from './Account.module.css';

type Step = 'start' | 'scan' | 'codes';

export function TwoFactorSetup({ onDone, onCancel }: { onDone?: () => void; onCancel?: () => void }) {
  const qc = useQueryClient();
  const [step, setStep] = useState<Step>('start');
  const [code, setCode] = useState('');
  const enable = useEnableTwoFactor();
  const key = useTwoFactorKey(step === 'scan');
  const confirm = useConfirmTwoFactor();
  const codes = useRecoveryCodes(step === 'codes');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    confirm.mutate(code.replace(/\s/g, ''), { onSuccess: () => setStep('codes') });
  };

  const finish = () => {
    qc.invalidateQueries({ queryKey: ['me'] });
    onDone?.();
  };

  return (
    <PasswordConfirm reason="Enter your password to set up two-factor sign-in.">
      {step === 'start' && (
        <div className={styles.form}>
          <p>
            Each time you log in, Tuklas will also ask for a 6-digit code from an authenticator app on your phone, such as Google Authenticator, Microsoft
            Authenticator or 2FAS. Someone who learns your password still can’t get in.
          </p>
          {enable.error && (
            <p className={styles.error} role="alert">
              {enable.error.message}
            </p>
          )}
          <div className={styles.actions}>
            <Button variant="primary" loading={enable.isPending} onClick={() => enable.mutate(undefined, { onSuccess: () => setStep('scan') })}>
              Set up two-factor sign-in
            </Button>
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
          </div>
        </div>
      )}

      {step === 'scan' && (
        <form className={styles.form} onSubmit={submit}>
          {key.isPending ? (
            <Skeleton />
          ) : key.error ? (
            <p className={styles.error} role="alert">
              {key.error.message}
            </p>
          ) : (
            <div className={styles.scan}>
              <img className={styles.qr} src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(key.data.svg)}`} alt="QR code to scan with your authenticator app" />
              <ol className={styles.steps}>
                <li>Open your authenticator app and add an account.</li>
                <li>Scan this QR code. If you can’t scan it, type in this key instead:
                  <code className={styles.secret}>{key.data.secretKey}</code>
                </li>
                <li>Enter the 6-digit code the app shows.</li>
              </ol>
            </div>
          )}
          <TextField
            className={styles.code}
            label="6-digit code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          {confirm.error && (
            <p className={styles.error} role="alert">
              {confirm.error.message}
            </p>
          )}
          <div className={styles.actions}>
            <Button type="submit" variant="primary" loading={confirm.isPending} disabled={!key.data}>
              Turn on
            </Button>
            {onCancel && <Button onClick={onCancel}>Cancel</Button>}
          </div>
        </form>
      )}

      {step === 'codes' && (
        <div className={styles.form}>
          <p>
            <strong>Two-factor sign-in is on.</strong> Save these recovery codes somewhere safe, away from your phone. If you lose the phone, each code
            lets you log in once.
          </p>
          {codes.data ? <RecoveryCodes codes={codes.data} /> : <Skeleton />}
          <div className={styles.actions}>
            <Button variant="primary" onClick={finish} disabled={!codes.data}>
              I’ve saved my codes
            </Button>
          </div>
        </div>
      )}
    </PasswordConfirm>
  );
}
