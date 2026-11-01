/**
 * ConversationList — the left column of Messages: every direct chat and group channel with its last
 * message and unread count, found by person, channel or group name and filtered to direct, channels
 * or unread, plus starting a new 1-on-1 chat. Message text isn't searched: it's encrypted (D7).
 */
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clsx from 'clsx';
import { Hash, PenSquare, Search, X } from 'lucide-react';
import { useMe } from '../../api/auth';
import { useConversations, useStartDirect, type ConversationSummary } from '../../api/chat';
import { relTime } from '../../lib/format';
import { PeoplePicker } from '../people/PeoplePicker';
import { Avatar } from '../ui/Avatar';
import { Chips } from '../ui/Chips';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { PresenceDot } from './Presence';
import styles from './ConversationList.module.css';

type Filter = 'all' | 'direct' | 'channel' | 'unread';

/** The words a chat is found by: the other person, or the channel and its group. Never message text (D7). */
const searchable = (c: ConversationSummary) => (c.kind === 'direct' ? [c.name] : [c.name, c.group?.name ?? '']);

export function ConversationList({ activeId }: { activeId: number | null }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [starting, setStarting] = useState(false);
  const { data, isPending } = useConversations();
  const term = q.trim().toLowerCase();

  const all = data ?? [];
  const byFilter = (c: ConversationSummary, f: Filter) => f === 'all' || (f === 'unread' ? c.unread > 0 : c.kind === f);
  const matches = (c: ConversationSummary) => term === '' || searchable(c).some((s) => s.toLowerCase().includes(term));
  const shown = all.filter((c) => byFilter(c, filter) && matches(c));
  const count = (f: Filter) => all.filter((c) => byFilter(c, f) && matches(c)).length;

  return (
    <div className={styles.column}>
      <div className={styles.tools}>
        <div className={styles.search}>
          <Search size={16} aria-hidden="true" className={styles.searchIcon} />
          <label className="sr-only" htmlFor="chat-search">
            Find a chat by person, channel or group
          </label>
          <input
            id="chat-search"
            type="search"
            className={styles.searchInput}
            placeholder="Find a person, channel or group"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <button type="button" className={clsx(styles.newChat, starting && styles.newChatOn)} onClick={() => setStarting((s) => !s)} aria-expanded={starting}>
          {starting ? <X size={18} aria-hidden="true" /> : <PenSquare size={18} aria-hidden="true" />}
          <span className="sr-only">{starting ? 'Cancel new message' : 'New message'}</span>
        </button>
      </div>
      {starting && <NewChat onDone={() => setStarting(false)} />}
      {all.length > 0 && (
        <div className={styles.filters}>
          <Chips
            label="Show"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All', count: count('all') },
              { value: 'direct', label: 'Direct', count: count('direct') },
              { value: 'channel', label: 'Channels', count: count('channel') },
              { value: 'unread', label: 'Unread', count: count('unread') },
            ]}
          />
        </div>
      )}
      {isPending ? (
        <div className={styles.loading}>
          <Skeleton />
          <Skeleton />
          <Skeleton />
        </div>
      ) : all.length === 0 ? (
        <p className={styles.empty}>No conversations yet. Start one with the pencil button, or join a research group to see its channels.</p>
      ) : shown.length === 0 ? (
        <p className={styles.empty}>
          {term
            ? `No chat with a person, channel or group called “${q.trim()}”. Messages themselves aren’t searched: they’re stored encrypted.`
            : filter === 'unread'
              ? 'You’re all caught up.'
              : 'Nothing here yet.'}
        </p>
      ) : (
        <ul className={styles.list} aria-label={term ? `Chats matching ${q.trim()}` : 'Conversations'}>
          {shown.map((c) => (
            <li key={c.id}>
              <ConversationRow c={c} active={c.id === activeId} term={term} />
            </li>
          ))}
        </ul>
      )}
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

function ConversationRow({ c, active, term }: { c: ConversationSummary; active: boolean; term: string }) {
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
          <span className={styles.name}>
            <Highlight text={c.name} term={term} />
          </span>
          {last && <time className={styles.time}>{relTime(last.createdAt)}</time>}
        </span>
        {c.group && (
          <span className={styles.group}>
            <Highlight text={c.group.name} term={term} />
          </span>
        )}
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

/** Marks where the search term appears, ignoring case. */
function Highlight({ text, term }: { text: string; term: string }) {
  const at = term ? text.toLowerCase().indexOf(term) : -1;
  if (at < 0) return <>{text}</>;
  const end = at + term.length;
  return (
    <>
      {text.slice(0, at)}
      <mark className={styles.mark}>{text.slice(at, end)}</mark>
      {text.slice(end)}
    </>
  );
}
