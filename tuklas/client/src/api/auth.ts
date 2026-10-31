/**
 * Auth API hooks — the signed-in user, login, signup, logout and demo reset (Fortify under /api/auth).
 * Login and signup write the user straight into the cached "me" query.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, LoginResult, PublicUser, SignupInput } from '../types/auth';
import { api, ApiError } from './client';

export type { PublicUser };

const ME = ['me'] as const;

/** The signed-in user, or null when logged out. */
export function useMe() {
  return useQuery({
    queryKey: ME,
    queryFn: async () => {
      try {
        return (await api<{ user: PublicUser }>('/auth/me')).user;
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null;
        throw e;
      }
    },
    staleTime: 5 * 60_000,
  });
}

/** Signs in. An account with 2FA gets `twoFactor: true` and no user until the code is entered. */
export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: LoginInput): Promise<LoginResult> => {
      const res = await api<{ user: PublicUser } | { two_factor: true }>('/auth/login', { body: input });
      return 'user' in res ? { user: res.user, twoFactor: false } : { user: null, twoFactor: true };
    },
    onSuccess: ({ user }) => {
      if (user) qc.setQueryData(ME, user);
    },
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => api<{ user: PublicUser }>('/auth/register', { body: input }),
    onSuccess: ({ user }) => qc.setQueryData(ME, user),
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/auth/logout', { method: 'POST' }),
    onSuccess: () => {
      qc.setQueryData(ME, null);
      qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' });
    },
  });
}

export function useResetDemo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<void>('/demo/reset', { method: 'POST' }),
    onSuccess: () => qc.invalidateQueries(),
  });
}
