/**
 * AnnouncementsPage — /announcements. System-wide, department and research-group announcements
 * in one feed, pinned first. Admins and educators with the announcement right can post.
 */
import { useState } from 'react';
import { Megaphone } from 'lucide-react';
import { useAnnouncements, type AnnouncementScope } from '../api/announcements';
import { AnnouncementList, canPostTo } from '../components/announcements/AnnouncementList';
import { PageHeader } from '../components/layout/PageHeader';
import { Button } from '../components/ui/Button';
import { Chips } from '../components/ui/Chips';
import styles from './AnnouncementsPage.module.css';

type Filter = 'all' | AnnouncementScope;

const emptyText: Record<Filter, string> = {
  all: 'Updates from the Office of Research, your department and your research groups will show up here.',
  system: 'Nothing has been announced to everyone yet.',
  department: 'Your department hasn’t posted anything yet.',
  group: 'Your research groups haven’t posted anything yet.',
};

export function AnnouncementsPage() {
  const [filter, setFilter] = useState<Filter>('all');
  const [composing, setComposing] = useState(false);
  const { data } = useAnnouncements();
  const canPost = canPostTo(data?.audiences);

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Updates from the Office of Research, your department and your research groups. Pinned notices stay on top."
        actions={
          canPost &&
          !composing && (
            <Button variant="primary" icon={<Megaphone size={18} aria-hidden="true" />} onClick={() => setComposing(true)}>
              New announcement
            </Button>
          )
        }
      />
      <div className={styles.filters}>
        <Chips
          label="Show"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: 'All', count: data?.unread || undefined },
            { value: 'system', label: 'Everyone' },
            { value: 'department', label: 'My department' },
            { value: 'group', label: 'My groups' },
          ]}
        />
      </div>
      <div className={styles.column}>
        <AnnouncementList scope={filter === 'all' ? undefined : filter} composing={composing} onComposingChange={setComposing} emptyText={emptyText[filter]} />
      </div>
    </>
  );
}
