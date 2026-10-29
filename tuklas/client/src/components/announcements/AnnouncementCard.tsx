/**
 * AnnouncementCard — one announcement in the feed: audience, title, author, formatted body and attachments.
 * Being on screen for a moment sends the read receipt. Authors and admins also see who has read it,
 * and can pin, edit or delete it.
 */
import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import { ChevronDown, Download, FileText, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import {
  useDeleteAnnouncement,
  useMarkAnnouncementRead,
  useReceipts,
  useUpdateAnnouncement,
  type AnnouncementView,
} from '../../api/announcements';
import { fileSize, fmtDate, relTime } from '../../lib/format';
import { Person } from '../people/Person';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TextField } from '../ui/Field';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { RichText } from './RichText';
import { RichTextEditor } from './RichTextEditor';
import styles from './AnnouncementCard.module.css';

const scopeTone: Record<AnnouncementView['scope'], BadgeTone> = { system: 'purple', department: 'blue', group: 'gold' };

export function AnnouncementCard({ item: a }: { item: AnnouncementView }) {
  const [editing, setEditing] = useState(false);
  const [showReceipts, setShowReceipts] = useState(false);
  const ref = useSeenOnScreen(a);
  const update = useUpdateAnnouncement();
  const del = useDeleteAnnouncement();
  const toast = useToast();

  return (
    <article ref={ref} id={`a-${a.id}`} className={clsx(styles.card, a.pinned && styles.pinned)} aria-labelledby={`a-${a.id}-title`}>
      <div className={styles.head}>
        {a.pinned && (
          <Badge tone="gold" icon={<Pin size={12} aria-hidden="true" />}>
            Pinned
          </Badge>
        )}
        <Badge tone={scopeTone[a.scope]}>{a.audience}</Badge>
        {!a.read && <Badge tone="ok">New</Badge>}
        <time className={styles.when} dateTime={a.createdAt} title={fmtDate(a.createdAt)}>
          {relTime(a.createdAt)}
        </time>
      </div>

      {editing ? (
        <EditForm item={a} onDone={() => setEditing(false)} />
      ) : (
        <>
          <h2 id={`a-${a.id}-title`} className={styles.title}>
            {a.title}
          </h2>
          <Person user={a.author} size="sm" sub={`Posted ${fmtDate(a.createdAt)}`} />
          <RichText source={a.body} className={styles.body} />
        </>
      )}

      {a.attachments.length > 0 && (
        <ul className={styles.files} aria-label="Attachments">
          {a.attachments.map((f) => (
            <li key={f.id} className={styles.file}>
              <FileText size={18} aria-hidden="true" className={styles.fileIcon} />
              <a href={`/api/announcements/${a.id}/attachments/${f.id}`} target="_blank" rel="noreferrer" className={styles.fileName}>
                {f.name}
              </a>
              <span className={styles.meta}>{fileSize(f.size)}</span>
              <a href={`/api/announcements/${a.id}/attachments/${f.id}?download=1`} className={styles.icon}>
                <Download size={16} aria-hidden="true" />
                <span className="sr-only">Download {f.name}</span>
              </a>
            </li>
          ))}
        </ul>
      )}

      {a.can.edit && !editing && (
        <footer className={styles.foot}>
          {a.receipts && (
            <button type="button" className={styles.receiptsToggle} aria-expanded={showReceipts} onClick={() => setShowReceipts((s) => !s)}>
              <progress className={styles.meter} value={a.receipts.read} max={Math.max(a.receipts.total, 1)} aria-hidden="true" />
              Seen by {a.receipts.read} of {a.receipts.total}
              <ChevronDown size={16} aria-hidden="true" className={styles.chevron} />
            </button>
          )}
          <div className={styles.tools}>
            <Button
              variant="ghost"
              icon={a.pinned ? <PinOff size={16} aria-hidden="true" /> : <Pin size={16} aria-hidden="true" />}
              disabled={update.isPending}
              onClick={() => update.mutate({ id: a.id, pinned: !a.pinned }, { onError: (e) => toast(e.message, 'error') })}
            >
              {a.pinned ? 'Unpin' : 'Pin'}
            </Button>
            <Button variant="ghost" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="ghost"
              icon={<Trash2 size={16} aria-hidden="true" />}
              disabled={del.isPending}
              onClick={() => window.confirm(`Delete “${a.title}” for everyone?`) && del.mutate(a.id, { onSuccess: () => toast('Announcement deleted.'), onError: (e) => toast(e.message, 'error') })}
            >
              Delete
            </Button>
          </div>
          {showReceipts && <Receipts id={a.id} />}
        </footer>
      )}
    </article>
  );
}

/**
 * Sends the read receipt once the announcement has been at least half on screen for a second,
 * so scrolling past doesn't count as reading.
 */
function useSeenOnScreen(a: AnnouncementView) {
  const ref = useRef<HTMLElement>(null);
  const mark = useMarkAnnouncementRead();
  const { mutate } = mark;
  useEffect(() => {
    const el = ref.current;
    if (a.read || !el) return;
    let timer: number | undefined;
    const io = new IntersectionObserver(
      ([entry]) => {
        window.clearTimeout(timer);
        if (entry?.isIntersecting) timer = window.setTimeout(() => mutate(a.id), 1000);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [a.id, a.read, mutate]);
  return ref;
}

function Receipts({ id }: { id: number }) {
  const { data, isPending } = useReceipts(id, true);
  if (isPending || !data) return <Skeleton className={styles.receiptsLoading} />;
  return (
    <div className={styles.receipts}>
      <section>
        <h3 className={styles.receiptsHead}>Read · {data.read.length}</h3>
        {data.read.length === 0 ? (
          <p className={styles.meta}>No one yet.</p>
        ) : (
          <ul className={styles.people}>
            {data.read.map((p) => (
              <li key={p.id}>
                <Person user={p} size="sm" sub={`Read ${relTime(p.readAt)}`} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h3 className={styles.receiptsHead}>Not yet · {data.unread.length}</h3>
        {data.unread.length === 0 ? (
          <p className={styles.meta}>Everyone has read it.</p>
        ) : (
          <ul className={styles.people}>
            {data.unread.map((p) => (
              <li key={p.id}>
                <Person user={p} size="sm" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function EditForm({ item, onDone }: { item: AnnouncementView; onDone: () => void }) {
  const [title, setTitle] = useState(item.title);
  const [body, setBody] = useState(item.body);
  const update = useUpdateAnnouncement();
  const toast = useToast();
  return (
    <form
      className={styles.edit}
      onSubmit={(e) => {
        e.preventDefault();
        update.mutate({ id: item.id, title, body }, { onSuccess: () => (toast('Announcement updated.', 'success'), onDone()), onError: (err) => toast(err.message, 'error') });
      }}
    >
      <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} />
      <RichTextEditor label="Announcement" value={body} onChange={setBody} />
      <div className={styles.tools}>
        <Button type="submit" variant="primary" loading={update.isPending}>
          Save changes
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
