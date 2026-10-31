/**
 * Presence — the green "online" dot and the "Online" / "Last seen 2 hours ago" line in chat,
 * kept live by lib/realtime.
 */
import clsx from 'clsx';
import type { ChatPerson } from '../../types/chat';
import { relTime } from '../../lib/format';
import { usePresence } from '../../lib/realtime';
import styles from './Presence.module.css';

export function PresenceDot({ person, className }: { person: ChatPerson; className?: string }) {
  const { online } = usePresence(person.id, person);
  return <span className={clsx(styles.dot, online && styles.online, className)} aria-label={online ? 'Online' : 'Offline'} role="img" />;
}

export function PresenceLine({ person }: { person: ChatPerson }) {
  const { online, lastSeenAt } = usePresence(person.id, person);
  return (
    <span className={clsx(styles.line, online && styles.onlineText)}>
      <span className={clsx(styles.dot, online && styles.online)} aria-hidden="true" />
      {online ? 'Online' : lastSeenAt ? `Last seen ${relTime(lastSeenAt)}` : 'Offline'}
    </span>
  );
}
