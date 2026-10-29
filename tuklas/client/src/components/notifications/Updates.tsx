/**
 * Updates — the notifications sheet for the signed-in person.
 * Opening an update marks it read and goes to its link; each type gets its own icon.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Bell, BookCheck, CalendarCheck, CircleAlert, MessageSquare, ShieldCheck, Users } from 'lucide-react';
import { useMarkRead, useNotifications } from '../../api/admin';
import { relTime } from '../../lib/format';
import { Sheet, SheetEmpty } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import styles from './Updates.module.css';

const iconFor = (type: string) => {
  if (type.startsWith('work_approved') || type === 'honor_verified' || type === 'educator_verified') return BookCheck;
  if (type.includes('revision') || type.includes('rejected') || type.includes('removed') || type.includes('declined')) return CircleAlert;
  if (type.includes('comment')) return MessageSquare;
  if (type.startsWith('event') || type.startsWith('ad_')) return CalendarCheck;
  if (type.startsWith('group') || type.includes('application')) return Users;
  if (type.includes('signup') || type.includes('claimed')) return ShieldCheck;
  return Bell;
};

/** Status changes and messages for the signed-in person. */
export function Updates({ limit = 6 }: { limit?: number }) {
  const { data, isPending } = useNotifications();
  const read = useMarkRead();
  const navigate = useNavigate();
  const [showAll, setShowAll] = useState(false);
  const items = data?.items.slice(0, showAll ? 30 : limit) ?? [];

  return (
    <Sheet
      title="Updates"
      aside={data?.unread ? `${data.unread} new` : undefined}
      flush
      actions={
        data?.unread ? (
          <button type="button" className={styles.markAll} onClick={() => read.mutate(undefined)}>
            Mark all read
          </button>
        ) : undefined
      }
    >
      {isPending ? (
        <div className={styles.loading}>
          <Skeleton />
          <Skeleton />
        </div>
      ) : items.length === 0 ? (
        <SheetEmpty>Nothing new. Status changes on your work and events show up here.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {items.map((n) => {
            const Icon = iconFor(n.type);
            return (
              <li key={n.id}>
                <button
                  type="button"
                  className={clsx(styles.item, !n.read && styles.unread)}
                  onClick={() => {
                    if (!n.read) read.mutate([n.id]);
                    navigate(n.link);
                  }}
                >
                  <Icon size={17} aria-hidden="true" className={styles.icon} />
                  <span className={styles.text}>
                    <span>{n.message}</span>
                    <time className={styles.when} dateTime={n.createdAt}>
                      {relTime(n.createdAt)}
                    </time>
                  </span>
                  {!n.read && <span className="sr-only">(new)</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {(data?.items.length ?? 0) > limit && (
        <button type="button" className={styles.more} onClick={() => setShowAll((s) => !s)}>
          {showAll ? 'Show fewer' : 'Show all updates'}
        </button>
      )}
    </Sheet>
  );
}
