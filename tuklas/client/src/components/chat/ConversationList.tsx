/**
 * ConversationList — the left column of Messages: search across all messages, start a new
 * 1-on-1 chat, and every direct chat and group channel with its last message and unread count.
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Hash, PenSquare, Search, X } from 'lucide-react';
import { useMe } from '../../api/auth';
import { useChatSearch, useConversations, useStartDirect, type ConversationSummary } from '../../api/chat';
import { relTime } from '../../lib/format';
import { useDebounced } from '../../lib/useDebounced';
import { PeoplePicker } from '../people/PeoplePicker';
import { Avatar } from '../ui/Avatar';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { PresenceDot } from './Presence';
import styles from './ConversationList.module.css';

export function ConversationList({ activeId }: { activeId: number | null }) {
  const [q, setQ] = useState('');
  const [starting, setStarting] = useState(false);
  const term = useDebounced(q, 250);
  const searching = term.trim().length >= 2;

  return (
    <div className={styles.column}>
      <div className={styles.tools}>
        <div className={styles.search}>
          <Search size={16} aria-hidden="true" className={styles.searchIcon} />
          <label className="sr-only" htmlFor="chat-search">
            Search messages
          </label>
          <input id="chat-search" type="search" className={styles.searchInput} placeholder="Search messages" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <button type="button" className={clsx(styles.newChat, starting && styles.newChatOn)} onClick={() => setStarting((s) => !s)} aria-expanded={starting}>
          {starting ? <X size={18} aria-hidden="true" /> : <PenSquare size={18} aria-hidden="true" />}
          <span className="sr-only">{starting ? 'Cancel new message' : 'New message'}</span>
        </button>
      </div>
      {starting && <NewChat onDone={() => setStarting(false)} />}
      {searching ? <SearchResults term={term} /> : <Conversations activeId={activeId} />}
    </div>
  );
}

function NewChat({ onDone }: { onDone: () => void }) {
  const { data: me } = useMe();
  const start = useStartDirect();
  const navigate = useNavigate();
  const toast = useToast();
  return (
    <div className={styles.newPanel}>
      <PeoplePicker
        label="New message to"
        roles={['student', 'educator']}
        exclude={me ? [me.id] : []}
        hint="Students and educators can message each other."
        onPick={(u) =>
          start.mutate(u.id, {
            onSuccess: ({ id }) => {
              onDone();
              navigate(`/messages/${id}`);
            },
            onError: (e) => toast(e.message, 'error'),
          })
        }
      />
    </div>
  );
}

function Conversations({ activeId }: { activeId: number | null }) {
  const { data, isPending } = useConversations();
  if (isPending)
    return (
      <div className={styles.loading}>
        <Skeleton />
        <Skeleton />
        <Skeleton />
      </div>
    );
  if (!data?.length) return <p className={styles.empty}>No conversations yet. Start one with the pencil button, or join a research group to see its channels.</p>;
  return (
    <ul className={styles.list} aria-label="Conversations">
      {data.map((c) => (
        <li key={c.id}>
          <ConversationRow c={c} active={c.id === activeId} />
        </li>
      ))}
    </ul>
  );
}

function ConversationRow({ c, active }: { c: ConversationSummary; active: boolean }) {
  const { data: me } = useMe();
  const last = c.lastMessage;
  const preview = last ? `${last.senderName === me?.name ? 'You' : last.senderName.split(' ')[0]}: ${last.text || (last.hasFile ? 'sent a file' : '')}` : 'No messages yet';
  return (
    <Link to={`/messages/${c.id}`} className={clsx(styles.row, active && styles.active, c.unread > 0 && styles.unread)} aria-current={active ? 'page' : undefined}>
      <span className={styles.avatar}>
        {c.kind === 'direct' && c.other ? (
          <>
            <Avatar name={c.other.name} role={c.other.role} photo={c.other.photoUrl} size="sm" />
            <PresenceDot person={c.other} className={styles.presence} />
          </>
        ) : (
          <span className={styles.channel} aria-hidden="true">
            <Hash size={17} />
          </span>
        )}
      </span>
      <span className={styles.text}>
        <span className={styles.top}>
          <span className={styles.name}>{c.name}</span>
          {last && <time className={styles.time}>{relTime(last.createdAt)}</time>}
        </span>
        {c.group && <span className={styles.group}>{c.group.name}</span>}
        <span className={styles.preview}>{preview}</span>
      </span>
      {c.unread > 0 && (
        <span className={styles.count}>
          {c.unread}
          <span className="sr-only"> unread</span>
        </span>
      )}
    </Link>
  );
}

function SearchResults({ term }: { term: string }) {
  const { data, isFetching } = useChatSearch(term);
  if (!data) return <p className={styles.empty}>Searching…</p>;
  if (data.length === 0) return <p className={styles.empty}>{isFetching ? 'Searching…' : `No messages mention “${term}”.`}</p>;
  return (
    <ul className={styles.list} aria-label={`Messages matching ${term}`} aria-busy={isFetching}>
      {data.map(({ message: m, conversation: c }) => (
        <li key={m.id}>
          <Link to={`/messages/${c.id}?m=${m.id}`} className={styles.row}>
            <span className={styles.avatar}>
              <Avatar name={m.sender.name} role={m.sender.role} photo={m.sender.photoUrl} size="sm" />
            </span>
            <span className={styles.text}>
              <span className={styles.top}>
                <span className={styles.name}>{c.kind === 'channel' ? `#${c.name}` : c.name}</span>
                <time className={styles.time}>{relTime(m.createdAt)}</time>
              </span>
              <span className={styles.preview}>
                {m.sender.name.split(' ')[0]}: <Highlight text={m.text} term={term} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Marks where the search term appears, ignoring case. */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = text.toLowerCase().indexOf(term.trim().toLowerCase());
  if (at < 0) return <>{text}</>;
  const end = at + term.trim().length;
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.mark}>{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  );
}
