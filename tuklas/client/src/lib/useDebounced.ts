/**
 * useDebounced — a hook that delays a changing value until input pauses.
 * Search boxes use it so typing does not send a request per keystroke.
 */
import { useEffect, useState } from 'react';

/** The value, once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return settled;
}
