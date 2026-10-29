/**
 * MessageItem — one chat message: sender, time, text (links made clickable), an attached file,
 * and its thread and delete actions. Consecutive messages from one sender collapse under one name.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Download, FileText, MessageSquareReply, Trash2 } from 'lucide-react';
import type { MessageView } from '../../api/chat';
import { fileSize } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import styles from './MessageItem.module.css';

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** Plain text with web links made clickable. Text is never parsed as HTML. */
function MessageText({ text }: { text: string }) {
  const parts: ReactNode[] = text.split(LINK).map((part, i) =>
    i % 2 === 1 ? (
      <a key={i} href={part} target="_blank" rel="noreferrer noopener">
        {part}
      </a>
    ) : (
      part
    ),
  );
  return <p className={styles.text}>{parts}</p>;
}

export const timeOf = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

export function MessageItem({
  message: m,
  continued,
  highlighted,
  onReply,
  onDelete,
}: {
  message: MessageView;
  /** Same sender as the message just above, moments later */
  continued: boolean;
  highlighted?: boolean;
  /** Opens the thread; absent inside a thread */
  onReply?: () => void;
  onDelete: () => void;
}) {
  return (
    <li id={`m-${m.id}`} className={clsx(styles.message, continued && styles.continued, highlighted && styles.highlighted)}>
      <div className={styles.gutter}>
        {continued ? (
          <time className={styles.gutterTime} dateTime={m.createdAt}>
            {timeOf(m.createdAt)}
          </time>
        ) : (
          <Avatar name={m.sender.name} role={m.sender.role} photo={m.sender.photoUrl} size="sm" />
        )}
      </div>
      <div className={styles.main}>
        {!continued && (
          <p className={styles.byline}>
            <span className={styles.name}>{m.sender.name}</span>
            <time className={styles.time} dateTime={m.createdAt}>
              {timeOf(m.createdAt)}
            </time>
          </p>
        )}
        {m.deleted ? (
          <p className={styles.removed}>Message removed</p>
        ) : (
          <>
            {m.text && <MessageText text={m.text} />}
            {m.file && <Attachment file={m.file} />}
            {m.removedFile && <p className={styles.removed}>{m.removedFile} was deleted from the group’s files.</p>}
          </>
        )}
        {onReply && m.replyCount > 0 && (
          <button type="button" className={styles.replies} onClick={onReply}>
            <MessageSquareReply size={15} aria-hidden="true" />
            {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
      {!m.deleted && (onReply || m.canDelete) && (
        <div className={styles.actions}>
          {onReply && (
            <button type="button" className={styles.action} onClick={onReply} title="Reply in thread">
              <MessageSquareReply size={16} aria-hidden="true" />
              <span className="sr-only">Reply in thread</span>
            </button>
          )}
          {m.canDelete && (
            <button type="button" className={styles.action} onClick={onDelete} title="Remove message">
              <Trash2 size={16} aria-hidden="true" />
              <span className="sr-only">Remove message</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

function Attachment({ file }: { file: NonNullable<MessageView['file']> }) {
  if (file.type.startsWith('image/'))
    return (
      <a href={file.url} target="_blank" rel="noreferrer" className={styles.image}>
        <img src={file.url} alt={file.name} loading="lazy" />
      </a>
    );
  return (
    <span className={styles.file}>
      <FileText size={18} aria-hidden="true" className={styles.fileIcon} />
      <a href={file.url} target="_blank" rel="noreferrer" className={styles.fileName}>
        {file.name}
      </a>
      <span className={styles.fileSize}>{fileSize(file.size)}</span>
      <a href={`${file.url}?download=1`} className={styles.download}>
        <Download size={16} aria-hidden="true" />
        <span className="sr-only">Download {file.name}</span>
      </a>
    </span>
  );
}
