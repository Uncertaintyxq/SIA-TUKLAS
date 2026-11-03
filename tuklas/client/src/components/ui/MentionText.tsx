/**
 * withMentions — turns @username in plain text into links to that person's portfolio. The pattern
 * matches the server's (App\Support\Mentions): not inside a word or an email address, so
 * "andrea@school.edu" stays plain. Text is never parsed as HTML; the links are React elements.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import styles from './MentionText.module.css';

// The character before the @ is captured (instead of a lookbehind) so older Safari can run it
const MENTION = /(^|[^A-Za-z0-9_.@])@([a-z0-9][a-z0-9-]{1,39})/gi;

export function withMentions(text: string, keyPrefix = 'm'): ReactNode[] {
  const parts: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(MENTION)) {
    const at = (m.index ?? 0) + m[1]!.length;
    if (at > last) parts.push(text.slice(last, at));
    const username = m[2]!.toLowerCase();
    parts.push(
      <Link key={`${keyPrefix}-${at}`} to={`/u/${username}`} className={styles.mention}>
        @{m[2]}
      </Link>,
    );
    last = at + 1 + m[2]!.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}
