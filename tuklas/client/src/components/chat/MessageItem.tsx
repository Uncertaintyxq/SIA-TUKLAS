/**
 * MessageItem — one chat message: sender, time, text (links made clickable), an attached file,
 * reactions, and its thread, react, edit, delete and report actions. Editing happens in place.
 * Consecutive messages from one sender collapse under one name.
 */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import clsx from 'clsx';
import { Download, FileText, Flag, MessageSquareReply, PenLine, SmilePlus, Trash2 } from 'lucide-react';
import type { MessageView } from '../../api/chat';
import { fileSize } from '../../lib/format';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import styles from './MessageItem.module.css';

const LINK = /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]'"])/g;

/** The emoji people can react with (the server allows only these, in this order) */
export const REACTION_EMOJI = ['👍', '❤️', '😂', '🎉', '🤔', '🙏'];

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

const names = (people: string[]) => (people.length <= 3 ? people.join(', ') : `${people.slice(0, 3).join(', ')} and ${people.length - 3} more`);

export function MessageItem({
  message: m,
  continued,
  highlighted,
  onReply,
  onDelete,
  onReport,
  onReact,
  onEdit,
}: {
  message: MessageView;
  /** Same sender as the message just above, moments later */
  continued: boolean;
  highlighted?: boolean;
  /** Opens the thread; absent inside a thread */
  onReply?: () => void;
  onDelete: () => void;
  /** Report to the admins; absent on your own messages */
  onReport?: () => void;
  /** Adds or takes back my reaction */
  onReact: (emoji: string) => void;
  /** Saves new text; call done() once it's saved */
  onEdit: (text: string, done: () => void) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [picking, setPicking] = useState(false);

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
        ) : editing ? (
          <EditBox
            initial={m.text}
            allowEmpty={m.file !== null || m.removedFile !== null}
            onCancel={() => setEditing(false)}
            onSave={(text) => (text === m.text ? setEditing(false) : onEdit(text, () => setEditing(false)))}
          />
        ) : (
          <>
            {m.text && <MessageText text={m.text} />}
            {m.file && <Attachment file={m.file} />}
            {m.removedFile && <p className={styles.removed}>{m.removedFile} was deleted from the group’s files.</p>}
            {m.editedAt && (
              <span className={styles.edited} title={`Edited ${new Date(m.editedAt).toLocaleString('en-US')}`}>
                (edited)
              </span>
            )}
          </>
        )}
        {!m.deleted && m.reactions.length > 0 && (
          <ul className={styles.reactions} aria-label="Reactions">
            {m.reactions.map((r) => (
              <li key={r.emoji}>
                <button
                  type="button"
                  className={styles.reaction}
                  aria-pressed={r.mine}
                  title={names(r.people)}
                  aria-label={`${r.emoji} ${r.count}: ${names(r.people)}${r.mine ? '. Select to take yours back' : ''}`}
                  onClick={() => onReact(r.emoji)}
                >
                  <span aria-hidden="true">{r.emoji}</span>
                  <span className={styles.reactionCount}>{r.count}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {picking && !m.deleted && (
          <div className={styles.picker} role="group" aria-label="Pick a reaction">
            {REACTION_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                className={styles.pick}
                aria-pressed={m.reactions.some((r) => r.emoji === e && r.mine)}
                onClick={() => {
                  onReact(e);
                  setPicking(false);
                }}
              >
                {e}
              </button>
            ))}
          </div>
        )}
        {onReply && m.replyCount > 0 && (
          <button type="button" className={styles.replies} onClick={onReply}>
            <MessageSquareReply size={15} aria-hidden="true" />
            {m.replyCount} {m.replyCount === 1 ? 'reply' : 'replies'}
          </button>
        )}
      </div>
      {!m.deleted && !editing && (
        <div className={styles.actions}>
          <button type="button" className={styles.action} onClick={() => setPicking((p) => !p)} title="React" aria-expanded={picking}>
            <SmilePlus size={16} aria-hidden="true" />
            <span className="sr-only">React</span>
          </button>
          {onReply && (
            <button type="button" className={styles.action} onClick={onReply} title="Reply in thread">
              <MessageSquareReply size={16} aria-hidden="true" />
              <span className="sr-only">Reply in thread</span>
            </button>
          )}
          {m.canEdit && (
            <button type="button" className={styles.action} onClick={() => setEditing(true)} title="Edit message">
              <PenLine size={16} aria-hidden="true" />
              <span className="sr-only">Edit message</span>
            </button>
          )}
          {m.canDelete && (
            <button type="button" className={styles.action} onClick={onDelete} title="Remove message">
              <Trash2 size={16} aria-hidden="true" />
              <span className="sr-only">Remove message</span>
            </button>
          )}
          {onReport && (
            <button type="button" className={styles.action} onClick={onReport} title="Report message">
              <Flag size={16} aria-hidden="true" />
              <span className="sr-only">Report message</span>
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/** In-place editor: Enter saves, Shift+Enter adds a line, Escape cancels (like the composer). */
function EditBox({ initial, allowEmpty, onSave, onCancel }: { initial: string; allowEmpty: boolean; onSave: (text: string) => void; onCancel: () => void }) {
  const [text, setText] = useState(initial);
  const empty = text.trim() === '' && !allowEmpty;
  const save = () => !empty && onSave(text.trim());
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      save();
    }
  };
  return (
    <div className={styles.editBox}>
      <textarea
        className={styles.editInput}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        rows={Math.min(8, Math.max(2, text.split('\n').length))}
        maxLength={4000}
        aria-label="Edit message"
        autoFocus
      />
      <div className={styles.editActions}>
        <span className={styles.editHint}>Enter to save · Esc to cancel</span>
        <Button onClick={onCancel}>Cancel</Button>
        <Button variant="primary" onClick={save} disabled={empty}>
          Save
        </Button>
      </div>
    </div>
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
