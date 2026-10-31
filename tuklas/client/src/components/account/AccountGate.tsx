/**
 * AccountGate — holds the app back until the signed-in account has finished setup: a confirmed
 * email, two-factor sign-in for educators and admins, and consent to the current privacy notice.
 * The server enforces the same rules (EnsureAccountReady); this shows the screen that fixes it.
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import type { PublicUser } from '../../types/auth';
import { ApiError } from '../../api/client';
import { useAcceptPrivacy, useResendVerification } from '../../api/account';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { useToast } from '../ui/Toast';
import { PrivacyNotice } from './PrivacyNotice';
import { SetupFrame } from './SetupFrame';
import { TwoFactorSetup } from './TwoFactorSetup';
import styles from './Account.module.css';

const SETUP_CODES = ['email_unverified', 'two_factor_required'];

export function AccountGate({ me, children }: { me: PublicUser; children: ReactNode }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const welcomed = useRef(false);

  // A request refused because setup is unfinished re-reads the account, which brings up the matching screen.
  useEffect(() => {
    const check = (error: unknown) => {
      if (error instanceof ApiError && error.code && SETUP_CODES.includes(error.code)) qc.invalidateQueries({ queryKey: ['me'] });
    };
    const offQueries = qc.getQueryCache().subscribe((e) => e.type === 'updated' && e.action.type === 'error' && check(e.action.error));
    const offMutations = qc.getMutationCache().subscribe((e) => e.type === 'updated' && e.action.type === 'error' && check(e.action.error));
    return () => {
      offQueries();
      offMutations();
    };
  }, [qc]);

  // The emailed verification link comes back as ?verified=1
  useEffect(() => {
    if (params.get('verified') !== '1' || welcomed.current) return;
    welcomed.current = true;
    toast('Email confirmed. Welcome to Tuklas.', 'success');
    const next = new URLSearchParams(params);
    next.delete('verified');
    setParams(next, { replace: true });
  }, [params, setParams, toast]);

  if (me.emailVerificationRequired) return <VerifyEmail me={me} expired={params.get('expired') === '1'} />;
  if (me.twoFactorRequired && !me.twoFactorEnabled)
    return (
      <SetupFrame title="Set up two-factor sign-in" sub="Educator and admin accounts need it, because they can approve and publish research." signedInAs={me.email}>
        <TwoFactorSetup />
      </SetupFrame>
    );
  if (!me.privacyAccepted) return <PrivacyConsent me={me} />;
  return children;
}

function VerifyEmail({ me, expired }: { me: PublicUser; expired: boolean }) {
  const qc = useQueryClient();
  const toast = useToast();
  const resend = useResendVerification();
  const [checking, setChecking] = useState(false);

  const recheck = async () => {
    setChecking(true);
    await qc.invalidateQueries({ queryKey: ['me'] });
    setChecking(false);
    if (qc.getQueryData<PublicUser>(['me'])?.emailVerificationRequired) toast('Not confirmed yet. Open the link in the email first.', 'info');
  };

  return (
    <SetupFrame title="Confirm your email" sub={<>We sent a link to <strong>{me.email}</strong>. Open it in this browser to finish creating your account.</>} signedInAs={me.email}>
      {expired && <Notice tone="warn">That link has expired or was changed. Send yourself a new one below.</Notice>}
      <p className={styles.muted}>No email after a few minutes? Check your spam folder, or send a new link. Only the newest link works.</p>
      {resend.error && (
        <p className={styles.error} role="alert">
          {resend.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="primary" loading={checking} onClick={recheck}>
          I’ve confirmed it
        </Button>
        <Button loading={resend.isPending} onClick={() => resend.mutate(undefined, { onSuccess: () => toast(`New link sent to ${me.email}.`, 'success') })}>
          Send a new link
        </Button>
      </div>
    </SetupFrame>
  );
}

function PrivacyConsent({ me }: { me: PublicUser }) {
  const accept = useAcceptPrivacy();
  const [agreed, setAgreed] = useState(false);
  return (
    <SetupFrame title="Our privacy notice has changed" sub="Please read it and accept it to keep using Tuklas." signedInAs={me.email} wide>
      <PrivacyNotice />
      <label className={styles.consent}>
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        I have read the privacy notice and agree that Tuklas may process my data as it describes.
      </label>
      {accept.error && (
        <p className={styles.error} role="alert">
          {accept.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="primary" disabled={!agreed} loading={accept.isPending} onClick={() => accept.mutate()}>
          Accept and continue
        </Button>
      </div>
    </SetupFrame>
  );
}
