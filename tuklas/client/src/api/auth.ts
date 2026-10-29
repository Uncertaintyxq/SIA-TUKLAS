/**
 * Auth API hooks — the signed-in user, login, signup, logout and demo reset.
 * Login and signup write the user straight into the cached "me" query.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, PublicUser, SignupInput } from '@server/schemas/auth';
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

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) => api<{ user: PublicUser }>('/auth/login', { body: input }),
    onSuccess: ({ user }) => qc.setQueryData(ME, user),
  });
}

export function useSignup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SignupInput) => api<{ user: PublicUser }>('/auth/signup', { body: input }),
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
