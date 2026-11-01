/**
 * Account API hooks — 2FA, passwords, email verification, sessions, email settings, privacy consent and data export.
 * Sign-in security goes through Fortify under /api/auth; privacy rights live under /api/account.
 */
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import type { PublicUser } from '../types/auth';
import type { AccountSession, ChangePasswordInput, NotificationSettings, PushStatus, ResetPasswordInput, TwoFactorChallengeInput, TwoFactorKey } from '../types/account';
import { api } from './client';

const ME = ['me'] as const;
const PASSWORD_CONFIRMED = ['account', 'password-confirmed'] as const;
const RECOVERY_CODES = ['account', 'recovery-codes'] as const;
const SESSIONS = ['account', 'sessions'] as const;

/** Where the browser downloads everything Tuklas holds about the signed-in person (a JSON file). */
export const EXPORT_URL = '/api/account/export';

const refreshMe = (qc: QueryClient) => qc.invalidateQueries({ queryKey: ME });

/** Finishes a 2FA login with a code from the authenticator app or a recovery code. */
export function useTwoFactorChallenge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TwoFactorChallengeInput) => api<{ user: PublicUser }>('/auth/two-factor-challenge', { body: input }),
    onSuccess: ({ user }) => qc.setQueryData(ME, user),
  });
}

/** Asks for a reset link. The answer is the same whether or not the email has an account. */
export function useForgotPassword() {
  return useMutation({ mutationFn: (email: string) => api<{ status: string }>('/auth/forgot-password', { body: { email } }) });
}

export function useResetPassword() {
  return useMutation({ mutationFn: (input: ResetPasswordInput) => api<unknown>('/auth/reset-password', { body: input }) });
}

export function useChangePassword() {
  return useMutation({ mutationFn: (input: ChangePasswordInput) => api<unknown>('/auth/user/password', { method: 'PUT', body: input }) });
}

export function useResendVerification() {
  return useMutation({ mutationFn: () => api<unknown>('/auth/email/verification-notification', { method: 'POST' }) });
}

/** Turning 2FA on or off needs the password again if it wasn't entered in the last few hours. */
export function usePasswordConfirmed() {
  return useQuery({
    queryKey: PASSWORD_CONFIRMED,
    queryFn: async () => (await api<{ confirmed: boolean }>('/auth/user/confirmed-password-status')).confirmed,
    staleTime: 0,
  });
}

export function useConfirmPassword() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api<unknown>('/auth/user/confirm-password', { body: { password } }),
    onSuccess: () => qc.setQueryData(PASSWORD_CONFIRMED, true),
  });
}

/** Creates a new 2FA secret. 2FA isn't on until a code from it is confirmed. */
export function useEnableTwoFactor() {
  return useMutation({ mutationFn: () => api<unknown>('/auth/user/two-factor-authentication', { method: 'POST' }) });
}

/** The QR code and secret of the 2FA key being set up. Never cached past the setup screen. */
export function useTwoFactorKey(enabled: boolean) {
  return useQuery({
    queryKey: ['account', 'two-factor-key'],
    queryFn: async (): Promise<TwoFactorKey> => {
      const [qr, secret] = await Promise.all([
        api<{ svg: string; url: string }>('/auth/user/two-factor-qr-code'),
        api<{ secretKey: string }>('/auth/user/two-factor-secret-key'),
      ]);
      return { ...qr, secretKey: secret.secretKey };
    },
    enabled,
    staleTime: Infinity,
    gcTime: 0,
  });
}

/**
 * Confirms the new 2FA key with a code from the app. Doesn't refresh the account: the setup screen
 * shows the recovery codes first and refreshes it once they're saved (TwoFactorSetup).
 */
export function useConfirmTwoFactor() {
  return useMutation({
    mutationFn: (code: string) => api<unknown>('/auth/user/confirmed-two-factor-authentication', { body: { code } }),
  });
}

export function useRecoveryCodes(enabled: boolean) {
  return useQuery({ queryKey: RECOVERY_CODES, queryFn: () => api<string[]>('/auth/user/two-factor-recovery-codes'), enabled, gcTime: 0 });
}

/** Replaces every recovery code; the old ones stop working. */
export function useRegenerateRecoveryCodes() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<unknown>('/auth/user/two-factor-recovery-codes', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: RECOVERY_CODES }),
  });
}

export function useDisableTwoFactor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<unknown>('/auth/user/two-factor-authentication', { method: 'DELETE' }),
    onSuccess: () => refreshMe(qc),
  });
}

export function useSessions() {
  return useQuery({ queryKey: SESSIONS, queryFn: () => api<AccountSession[]>('/account/sessions') });
}

/** Signs out every other browser. Needs the current password. */
export function useLogoutOthers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api<void>('/account/sessions/logout-others', { body: { password } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: SESSIONS }),
  });
}

/** Deletes the signed-in account (needs the password) and forgets everything cached about it. */
export function useDeleteAccount() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => api<void>('/account', { method: 'DELETE', body: { password } }),
    onSuccess: () => {
      qc.setQueryData(ME, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
  });
}

export function useAcceptPrivacy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/account/privacy', { body: { accept: true } }),
    onSuccess: () => refreshMe(qc),
  });
}

const NOTIFICATION_SETTINGS = ['account', 'notifications'] as const;

export function useNotificationSettings() {
  return useQuery({ queryKey: NOTIFICATION_SETTINGS, queryFn: () => api<NotificationSettings>('/account/notifications') });
}

/** Saves the email choices and the digest; the answer is the saved settings. */
export function useSaveNotificationSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (s: Pick<NotificationSettings, 'email' | 'push' | 'digest'>) => api<NotificationSettings>('/account/notifications', { method: 'PUT', body: s }),
    onSuccess: (saved) => qc.setQueryData(NOTIFICATION_SETTINGS, saved),
  });
}

/** Push on this device: whether the server can send, and whether this browser is subscribed. */
export function usePushStatus(endpoint: string | null) {
  return useQuery({ queryKey: ['account', 'push', endpoint], queryFn: () => api<PushStatus>(`/account/push${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ''}`) });
}

/** Saves this browser's push subscription (from pushManager.subscribe), or removes it. */
export function useSetPush() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subscription, on }: { subscription: PushSubscription; on: boolean }) =>
      on
        ? api('/account/push', { body: subscription.toJSON() })
        : api('/account/push', { method: 'DELETE', body: { endpoint: subscription.endpoint } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['account', 'push'] }),
  });
}
