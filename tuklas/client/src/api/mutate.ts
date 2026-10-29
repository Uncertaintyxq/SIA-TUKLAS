/**
 * useAction — the shared mutation wrapper behind every write in the API hooks.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * A mutation that refreshes every cached view afterwards. One approval touches the work, the
 * review board, the feed, portfolios and notifications, so a precise list would always miss one.
 */
export function useAction<TVars = void, TResult = void>(fn: (vars: TVars) => Promise<TResult>) {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries() });
}
