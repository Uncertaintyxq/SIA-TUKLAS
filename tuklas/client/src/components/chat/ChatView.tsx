/**
 * ChatView — one conversation: header (person and presence, or channel), the message history with
 * day breaks and older pages, the composer, and a side panel for threads. Used by Messages and group pages;
 * give it key={conversationId} so switching conversations starts fresh.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { ArrowLeft, Hash, X } from 'lucide-react';
import { useMe } from '../../api/auth';
import {
  useConversation,
  useDeleteMessage,
  useEditMessage,
  useMarkConversationRead,
  useReactToMessage,
  useThread,
  type ConversationPage,
  type ConversationSummary,
  type MessageView,
} from '../../api/chat';
import { fmtDate, isoDate } from '../../lib/format';
import { useReport } from '../reports/ReportDialog';
import { Avatar } from '../ui/Avatar';
import { EmptyState } from '../ui/EmptyState';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { MessageComposer } from './MessageComposer';
import { MessageItem } from './MessageItem';
import { PresenceLine } from './Presence';
import styles from './ChatView.module.css';

const FIVE_MINUTES = 5 * 60_000;

export function ChatView({ conversationId, embedded = false, backTo }: { conversationId: number; embedded?: boolean; backTo?: string }) {
  const { data: me } = useMe();
  const q = useConversation(conversationId);
  const [threadOf, setThreadOf] = useState<number | null>(null);
  const [params] = useSearchParams();
  const highlight = Number(params.get('m')) || null;
  const remove = useDeleteMessage();
  const markRead = useMarkConversationRead();
  const toast = useToast();
  const scroller = useRef<HTMLDivElement>(null);

  const pages = q.data?.pages;
  const conversation = pages?.[0]?.conversation;
  // Pages arrive newest first; each page is oldest → newest.
  const messages = useMemo(() => (pages ? [...pages].reverse().flatMap((p) => p.messages) : []), [pages]);
  const firstId = messages[0]?.id;
  const lastId = messages.at(-1)?.id;

  useScrollKeeping(scroller, firstId, lastId, highlight);

  // Reading the conversation moves my read marker, also when new messages arrive while it's open.
  const { mutate: markReadMutate } = markRead;
  useEffect(() => {
    if (conversation) markReadMutate(conversationId);
  }, [conversationId, lastId, conversation, markReadMutate]);

  const del = (m: MessageView) =>
    window.confirm('Remove this message for everyone?') && remove.mutate(m.id, { onError: (e) => toast(e.message, 'error') });
  const { report, dialog: reportDialog } = useReport();
  const reportOf = (m: MessageView) => (m.sender.id === me?.id ? undefined : () => report({ type: 'message', id: m.id, label: 'this message' }));
  const { onReact, onEdit } = useMessageActions();

  if (q.isPending) return <Skeleton className={styles.loading} />;
  if (q.error || !conversation)
    return (
      <div className={styles.missing}>
        <EmptyState title="This conversation isn’t available">You may have left the group, or the link is wrong.</EmptyState>
      </div>
    );

  return (
    <section className={styles.chat} aria-label={`Conversation: ${conversation.name}`}>
      <div className={clsx(styles.columns, threadOf !== null && styles.withThread)}>
        <div className={styles.thread}>
          {!embedded && <ChatHeader conversation={conversation} backTo={backTo} />}
          <div ref={scroller} className={styles.scroll}>
            {q.hasNextPage && (
              <button type="button" className={styles.older} onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {q.isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
              </button>
            )}
            {messages.length === 0 ? (
              <p className={styles.start}>
                {conversation.kind === 'direct' ? `This is the start of your conversation with ${conversation.name}.` : `This is the start of #${conversation.name}.`}
              </p>
            ) : (
              <ol className={styles.list}>
                {messages.map((m, i) => {
                  const prev = messages[i - 1];
                  const newDay = !prev || isoDate(prev.createdAt) !== isoDate(m.createdAt);
                  const continued = !newDay && prev?.sender.id === m.sender.id && !prev.deleted && new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < FIVE_MINUTES;
                  return (
                    <DayAndMessage key={m.id} showDay={newDay} iso={m.createdAt}>
                      <MessageItem
                        message={m}
                        continued={continued}
                        highlighted={m.id === highlight}
                        onReply={() => setThreadOf(m.id)}
                        onDelete={() => del(m)}
                        onReport={reportOf(m)}
                        onReact={onReact(m)}
                        onEdit={onEdit(m)}
                      />
                    </DayAndMessage>
                  );
                })}
                <SeenLine message={messages[messages.length - 1]} meId={me?.id} readers={pages![0]!.readers} direct={conversation.kind === 'direct'} />
              </ol>
            )}
          </div>
          <MessageComposer
            conversationId={conversationId}
            placeholder={conversation.kind === 'direct' ? `Message ${conversation.name}` : `Message #${conversation.name}`}
            canMentionAll={conversation.canMentionAll}
          />
        </div>
        {threadOf !== null && (
          <ThreadPanel conversationId={conversationId} messageId={threadOf} onClose={() => setThreadOf(null)} meId={me?.id} canMentionAll={conversation.canMentionAll} />
        )}
      </div>
      {reportDialog}
    </section>
  );
}

function DayAndMessage({ showDay, iso, children }: { showDay: boolean; iso: string; children: ReactNode }) {
  return (
    <>
      {showDay && (
        <li className={styles.day} role="presentation">
          <span>{dayLabel(iso)}</span>
        </li>
      )}
      {children}
    </>
  );
}

function dayLabel(iso: string) {
  const day = isoDate(iso);
  if (day === isoDate(new Date().toISOString())) return 'Today';
  if (day === isoDate(new Date(Date.now() - 86_400_000).toISOString())) return 'Yesterday';
  return fmtDate(iso);
}

function ChatHeader({ conversation: c, backTo }: { conversation: ConversationSummary; backTo?: string }) {
  return (
    <header className={styles.head}>
      {backTo && (
        <Link to={backTo} className={styles.back}>
          <ArrowLeft size={20} aria-hidden="true" />
          <span className="sr-only">All conversations</span>
        </Link>
      )}
      {c.kind === 'direct' && c.other ? (
        <Link to={`/u/${c.other.username}`} className={styles.who}>
          <Avatar name={c.other.name} role={c.other.role} photo={c.other.photoUrl} size="sm" />
          <span className={styles.whoText}>
            <span className={styles.whoName}>{c.other.name}</span>
            <PresenceLine person={c.other} />
          </span>
        </Link>
      ) : (
        <div className={styles.who}>
          <span className={styles.channelIcon} aria-hidden="true">
            <Hash size={18} />
          </span>
          <span className={styles.whoText}>
            <span className={styles.whoName}>{c.name}</span>
            {c.group && (
              <Link to={`/groups/${c.group.id}`} className={styles.groupLink}>
                {c.group.name}
              </Link>
            )}
          </span>
        </div>
      )}
    </header>
  );
}

/**
 * Keeps the view where the reader expects: at the bottom on open and when new messages arrive
 * (if they were already near it), steady when older messages load above, and on a searched-for message.
 * The scroller has overflow-anchor: none, so these adjustments are the only ones.
 */
function useScrollKeeping(scroller: RefObject<HTMLDivElement | null>, firstId: number | undefined, lastId: number | undefined, highlight: number | null) {
  const prev = useRef<{ firstId?: number; lastId?: number; height: number }>({ height: 0 });

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || lastId === undefined) return;
    const before = prev.current;
    if (before.lastId === undefined) {
      const target = highlight ? document.getElementById(`m-${highlight}`) : null;
      if (target) target.scrollIntoView({ block: 'center' });
      else el.scrollTop = el.scrollHeight;
    } else if (firstId !== before.firstId && lastId === before.lastId) {
      el.scrollTop += el.scrollHeight - before.height;
    } else if (lastId !== before.lastId && before.height - el.scrollTop - el.clientHeight < 120) {
      el.scrollTop = el.scrollHeight;
    }
    prev.current = { firstId, lastId, height: el.scrollHeight };
  }, [firstId, lastId, highlight, scroller]);
}

function ThreadPanel({
  conversationId,
  messageId,
  onClose,
  meId,
  canMentionAll,
}: {
  conversationId: number;
  messageId: number;
  onClose: () => void;
  meId?: number;
  canMentionAll: boolean;
}) {
  const { data, isPending, error } = useThread(messageId);
  const remove = useDeleteMessage();
  const toast = useToast();
  const end = useRef<HTMLDivElement>(null);
  const count = data?.replies.length ?? 0;

  // Block body on purpose: scrollIntoView returns a Promise in current browsers, and an effect may only return a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' });
  }, [count]);

  const del = (m: MessageView) =>
    window.confirm('Remove this message for everyone?') && remove.mutate(m.id, { onError: (e) => toast(e.message, 'error') });
  const { report, dialog: reportDialog } = useReport();
  const reportOf = (m: MessageView) => (m.sender.id === meId ? undefined : () => report({ type: 'message', id: m.id, label: 'this message' }));
  const { onReact, onEdit } = useMessageActions();

  return (
    <aside className={styles.threadPanel} aria-label="Thread">
      <header className={styles.threadHead}>
        <h3 className={styles.threadTitle}>Thread</h3>
        <button type="button" className={styles.close} onClick={onClose}>
          <X size={18} aria-hidden="true" />
          <span className="sr-only">Close thread</span>
        </button>
      </header>
      <div className={styles.scroll}>
        {isPending ? (
          <Skeleton className={styles.threadLoading} />
        ) : error || !data ? (
          <p className={styles.start}>This message was removed.</p>
        ) : (
          <ol className={styles.list}>
            <MessageItem message={data.parent} continued={false} onDelete={() => del(data.parent)} onReport={reportOf(data.parent)} onReact={onReact(data.parent)} onEdit={onEdit(data.parent)} />
            <li className={styles.day} role="presentation">
              <span>
                {count} {count === 1 ? 'reply' : 'replies'}
              </span>
            </li>
            {data.replies.map((m, i) => (
              <MessageItem
                key={m.id}
                message={m}
                continued={i > 0 && data.replies[i - 1]!.sender.id === m.sender.id}
                onDelete={() => del(m)}
                onReport={reportOf(m)}
                onReact={onReact(m)}
                onEdit={onEdit(m)}
              />
            ))}
          </ol>
        )}
        <div ref={end} />
      </div>
      {data && !data.parent.deleted && (
        <MessageComposer
          conversationId={conversationId}
          parentId={messageId}
          placeholder={meId === data.parent.sender.id ? 'Add to your thread' : 'Reply in thread'}
          canMentionAll={canMentionAll}
        />
      )}
      {reportDialog}
    </aside>
  );
}

/** Reacting and editing, with errors shown as a toast. Shared by the conversation and its threads. */
function useMessageActions() {
  const edit = useEditMessage();
  const react = useReactToMessage();
  const toast = useToast();
  return {
    onReact: (m: MessageView) => (emoji: string) => react.mutate({ id: m.id, emoji }, { onError: (e) => toast(e.message, 'error') }),
    onEdit: (m: MessageView) => (text: string, done: () => void) => edit.mutate({ id: m.id, text }, { onSuccess: done, onError: (e) => toast(e.message, 'error') }),
  };
}

/** "Seen" (direct chat) or "Seen by …" (channel) under my latest message, from the others' read markers. */
function SeenLine({ message, meId, readers, direct }: { message: MessageView | undefined; meId?: number; readers: ConversationPage['readers']; direct: boolean }) {
  if (!message || message.deleted || message.sender.id !== meId) return null;
  const seen = readers.filter((r) => new Date(r.readAt).getTime() >= new Date(message.createdAt).getTime());
  if (seen.length === 0) return null;
  const who = seen.map((r) => r.name.split(' ')[0]);
  const label = direct
    ? 'Seen'
    : seen.length === readers.length && readers.length > 1
      ? 'Seen by everyone'
      : `Seen by ${who.length <= 3 ? who.join(', ') : `${who.slice(0, 3).join(', ')} and ${who.length - 3} more`}`;
  return (
    <li className={styles.seen} title={seen.map((r) => r.name).join(', ')}>
      {label}
    </li>
  );
}
