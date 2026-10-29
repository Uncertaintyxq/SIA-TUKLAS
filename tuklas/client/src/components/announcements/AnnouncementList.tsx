/**
 * AnnouncementList — announcements for one filter (all, a scope, or one group), pinned first,
 * with the composer above them when the viewer may post. Used by the Announcements page and group pages.
 */
import { useEffect } from 'react';
import { useAnnouncements, type AnnouncementScope, type AnnouncementsResponse } from '../../api/announcements';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { AnnouncementCard } from './AnnouncementCard';
import { AnnouncementComposer } from './AnnouncementComposer';
import styles from './AnnouncementList.module.css';

export function AnnouncementList({
  scope,
  group,
  composing,
  onComposingChange,
  emptyText,
}: {
  scope?: AnnouncementScope;
  /** Show and post to this research group only */
  group?: { id: number; name: string };
  composing: boolean;
  onComposingChange: (open: boolean) => void;
  emptyText: string;
}) {
  const { data, isPending } = useAnnouncements({ scope: group ? 'group' : scope, groupId: group?.id });

  // Deep links from notifications (/announcements#a-12) scroll once the list is there.
  useEffect(() => {
    if (data && window.location.hash.startsWith('#a-')) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [data]);

  if (isPending || !data)
    return (
      <div className={styles.list} aria-busy="true">
        <Skeleton className={styles.skeleton} />
        <Skeleton className={styles.skeleton} />
      </div>
    );

  return (
    <div className={styles.list}>
      {composing && <AnnouncementComposer audiences={data.audiences} fixedGroup={group} onDone={() => onComposingChange(false)} />}
      {data.items.length === 0 ? (
        <EmptyState title="No announcements yet">{emptyText}</EmptyState>
      ) : (
        data.items.map((a) => <AnnouncementCard key={a.id} item={a} />)
      )}
    </div>
  );
}

/** Whether the viewer can post anywhere (or to the given group). */
export function canPostTo(audiences: AnnouncementsResponse['audiences'] | undefined, groupId?: number) {
  if (!audiences) return false;
  if (groupId) return audiences.groups.some((g) => g.id === groupId);
  return audiences.system || audiences.departments.length > 0 || audiences.groups.length > 0;
}
