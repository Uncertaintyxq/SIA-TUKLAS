/**
 * WorkEntry — the card for one published work in the feed, portfolios and libraries.
 * Also exports useShare, the copy-link helper other pages reuse.
 */
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { Bookmark, BookmarkCheck, Link2, MessageSquare, Sparkles } from 'lucide-react';
import type { WorkCard } from '../../types/works';
import { useSave } from '../../api/works';
import { entryNo, isoDate } from '../../lib/format';
import { Byline } from '../people/Person';
import { useToast } from '../ui/Toast';
import { ApprovalLine } from './ApprovalLine';
import { TypeTag } from './WorkBadges';
import styles from './WorkEntry.module.css';

/** Copies a link to the clipboard, falling back to showing it. */
export function useShare() {
  const toast = useToast();
  return (path: string, what = 'Link') => {
    const url = `${window.location.origin}${path}`;
    (navigator.clipboard?.writeText(url) ?? Promise.reject()).then(
      () => toast(`${what} copied.`, 'success'),
      () => toast(url),
    );
  };
}

/** A published work as a notebook entry: number, type, title, byline, abstract, keywords, and who approved it. */
export function WorkEntry({ work: w, compact = false }: { work: WorkCard; compact?: boolean }) {
  const save = useSave();
  const share = useShare();
  const toast = useToast();

  return (
    <article className={clsx(styles.entry, compact && styles.compact)}>
      <div className={styles.head}>
        <span className={styles.no}>{entryNo(w.id)}</span>
        <TypeTag type={w.type} />
        {w.department && <span className={styles.dept}>{w.department}</span>}
        {w.approvedAt && <time className={styles.date}>{isoDate(w.approvedAt)}</time>}
      </div>
      <h3 className={styles.title}>
        <Link to={`/works/${w.id}`} className={styles.titleLink}>
          {w.title}
        </Link>
      </h3>
      <p className={styles.by}>
        <Byline users={w.authors} />
      </p>
      {!compact && <p className={styles.abstract}>{w.abstract}</p>}
      {!compact && w.tags.length > 0 && (
        <ul className={styles.tags} aria-label="Keywords">
          {w.tags.map((t) => (
            <li key={t}>
              <Link to={`/feed?q=${encodeURIComponent(t)}`} className={styles.tag}>
                #{t}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {w.approval && <ApprovalLine approval={w.approval} className={styles.approval} />}
      {!compact && w.approval && (
        <div className={styles.actions}>
          <Link to={`/works/${w.id}#reactions`} className={styles.action} aria-label={`${w.reactionCount} reactions`}>
            <Sparkles size={17} aria-hidden="true" />
            <span>{w.reactionCount}</span>
          </Link>
          <Link to={`/works/${w.id}#discussion`} className={styles.action} aria-label={`${w.commentCount} comments`}>
            <MessageSquare size={17} aria-hidden="true" />
            <span>{w.commentCount}</span>
          </Link>
          <button
            type="button"
            className={styles.action}
            aria-pressed={w.saved}
            disabled={save.isPending}
            onClick={() =>
              save.mutate(
                { id: w.id, saved: !w.saved },
                { onSuccess: () => toast(w.saved ? 'Removed from your library.' : 'Saved to your library.', 'success'), onError: (e) => toast(e.message, 'error') },
              )
            }
          >
            {w.saved ? <BookmarkCheck size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
            <span>{w.saved ? 'Saved' : 'Save'}</span>
          </button>
          <button type="button" className={styles.action} onClick={() => share(`/works/${w.id}`)}>
            <Link2 size={17} aria-hidden="true" />
            <span>Share</span>
          </button>
          <Link to={`/works/${w.id}`} className={clsx(styles.action, styles.read)}>
            Read the work
          </Link>
        </div>
      )}
    </article>
  );
}
