/**
 * GroupPage — /groups/:id. A research group's workspace: chat channels with threads, group announcements,
 * the shared file repository, deadlines and an activity log, with members and their roles alongside.
 * What each person can do comes from the server (`can`), which applies the group rules.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { CalendarPlus, Download, FileText, Hash, LogOut, Megaphone, Plus, Trash2, UserMinus } from 'lucide-react';
import { useMe } from '../api/auth';
import {
  useAddDeadline,
  useAddMember,
  useCreateChannel,
  useDeleteChannel,
  useDeleteDeadline,
  useDeleteGroup,
  useDeleteGroupFile,
  useGroup,
  useRemoveMember,
  useSetMemberRole,
  useUploadGroupFile,
  type GroupDetail,
  type GroupRole,
} from '../api/groups';
import { AnnouncementList } from '../components/announcements/AnnouncementList';
import { ChatView } from '../components/chat/ChatView';
import { PageHeader } from '../components/layout/PageHeader';
import { Person } from '../components/people/Person';
import { PeoplePicker } from '../components/people/PeoplePicker';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { Chips } from '../components/ui/Chips';
import { EmptyState } from '../components/ui/EmptyState';
import { SelectField, TextField } from '../components/ui/Field';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { Avatar } from '../components/ui/Avatar';
import { fileSize, fmtDate, isoDate, relTime } from '../lib/format';
import styles from './GroupPage.module.css';

type Tab = 'chat' | 'announcements' | 'files' | 'deadlines' | 'activity';
const tabs: Tab[] = ['chat', 'announcements', 'files', 'deadlines', 'activity'];

export function GroupPage() {
  const id = Number(useParams().id);
  const { data: me } = useMe();
  const { data: g, isPending, error } = useGroup(id);
  const [params, setParams] = useSearchParams();
  const tab = tabs.find((t) => t === params.get('tab')) ?? 'chat';
  const removeMember = useRemoveMember();
  const del = useDeleteGroup();
  const toast = useToast();
  const navigate = useNavigate();

  if (isPending) return <Skeleton className={styles.skeleton} />;
  if (error || !g)
    return (
      <EmptyState title="You’re not in this group" action={<ButtonLink to="/groups">Your groups</ButtonLink>}>
        Only the adviser, its members and admins can open a research group.
      </EmptyState>
    );

  const isMember = g.members.some((m) => m.id === me?.id);
  const unread = g.channels.reduce((n, c) => n + c.unread, 0);
  const fail = (e: Error) => toast(e.message, 'error');

  return (
    <>
      <PageHeader
        title={g.name}
        description={g.description || 'Research group'}
        actions={
          <>
            {isMember && (
              <Button
                icon={<LogOut size={16} aria-hidden="true" />}
                onClick={() =>
                  window.confirm(`Leave “${g.name}”?`) &&
                  removeMember.mutate({ id: g.id, userId: me!.id }, { onSuccess: () => navigate('/groups', { replace: true }), onError: fail })
                }
              >
                Leave group
              </Button>
            )}
            {g.can.manage && (
              <Button
                variant="danger"
                icon={<Trash2 size={16} aria-hidden="true" />}
                onClick={() =>
                  window.confirm(`Delete “${g.name}” with its chat, files and announcements?`) &&
                  del.mutate(g.id, {
                    onSuccess: () => {
                      toast('Group deleted.');
                      navigate('/groups', { replace: true });
                    },
                    onError: fail,
                  })
                }
              >
                Delete group
              </Button>
            )}
          </>
        }
      />
      <div className={styles.layout}>
        <div className={styles.main}>
          <Chips
            label="Workspace"
            value={tab}
            onChange={(t) => setParams(t === 'chat' ? {} : { tab: t }, { replace: true })}
            options={[
              { value: 'chat', label: 'Chat', count: unread || undefined },
              { value: 'announcements', label: 'Announcements' },
              { value: 'files', label: 'Files', count: g.files.length },
              { value: 'deadlines', label: 'Deadlines', count: g.deadlines.length },
              { value: 'activity', label: 'Activity' },
            ]}
          />
          {tab === 'chat' && <Channels group={g} />}
          {tab === 'announcements' && <GroupAnnouncements group={g} />}
          {tab === 'files' && <Files groupId={g.id} files={g.files} />}
          {tab === 'deadlines' && <Deadlines groupId={g.id} deadlines={g.deadlines} organize={g.can.organize} />}
          {tab === 'activity' && <Activity items={g.activity} />}
        </div>
        <aside className={styles.side}>
          <Members group={g} />
        </aside>
      </div>
    </>
  );
}

// ---------- Chat channels ----------

function Channels({ group: g }: { group: GroupDetail }) {
  const [selected, setSelected] = useState<number | null>(null);
  const [name, setName] = useState('');
  const create = useCreateChannel();
  const remove = useDeleteChannel();
  const toast = useToast();
  const channel = g.channels.find((c) => c.id === selected) ?? g.channels[0];

  const add = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { id: g.id, name },
      {
        onSuccess: ({ id }) => {
          setName('');
          setSelected(id);
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  return (
    <section className={styles.chat} aria-label="Group chat">
      <div className={styles.channelBar}>
        <ul className={styles.channels} aria-label="Channels">
          {g.channels.map((c) => (
            <li key={c.id}>
              <button type="button" className={styles.channel} aria-pressed={c.id === channel?.id} onClick={() => setSelected(c.id)}>
                <Hash size={15} aria-hidden="true" />
                {c.name}
                {c.unread > 0 && <span className={styles.unread}>{c.unread}</span>}
              </button>
            </li>
          ))}
        </ul>
        {g.can.organize && (
          <form className={styles.newChannel} onSubmit={add}>
            <label className="sr-only" htmlFor="new-channel">
              New channel name
            </label>
            <input id="new-channel" className={styles.channelInput} value={name} onChange={(e) => setName(e.target.value)} placeholder="new-channel" maxLength={40} />
            <button type="submit" className={styles.iconButton} disabled={name.trim().length < 2 || create.isPending}>
              <Plus size={16} aria-hidden="true" />
              <span className="sr-only">Add channel</span>
            </button>
          </form>
        )}
        {g.can.manage && channel && channel.name !== 'general' && (
          <button
            type="button"
            className={styles.iconButton}
            title={`Delete #${channel.name}`}
            onClick={() =>
              window.confirm(`Delete #${channel.name} and its messages? Files shared there stay in the group’s files.`) &&
              remove.mutate({ id: g.id, channelId: channel.id }, { onSuccess: () => setSelected(null), onError: (err) => toast(err.message, 'error') })
            }
          >
            <Trash2 size={16} aria-hidden="true" />
            <span className="sr-only">Delete #{channel.name}</span>
          </button>
        )}
      </div>
      <div className={styles.chatBody}>{channel ? <ChatView key={channel.id} conversationId={channel.id} embedded /> : <SheetEmpty>No channels yet.</SheetEmpty>}</div>
    </section>
  );
}

// ---------- Announcements ----------

function GroupAnnouncements({ group: g }: { group: GroupDetail }) {
  const [composing, setComposing] = useState(false);
  return (
    <div className={styles.stack}>
      {g.can.announce && !composing && (
        <Button variant="primary" icon={<Megaphone size={16} aria-hidden="true" />} onClick={() => setComposing(true)} className={styles.announce}>
          New group announcement
        </Button>
      )}
      <AnnouncementList
        group={{ id: g.id, name: g.name }}
        composing={composing}
        onComposingChange={setComposing}
        emptyText="The adviser and mentors post group updates here. Members get an alert and an email."
      />
    </div>
  );
}

// ---------- Members ----------

const seatLabel = { leader: 'Group leader', member: 'Member', mentor: 'Mentor' } as const;

function Members({ group: g }: { group: GroupDetail }) {
  const addMember = useAddMember();
  const removeMember = useRemoveMember();
  const setRole = useSetMemberRole();
  const toast = useToast();
  const fail = (e: Error) => toast(e.message, 'error');

  return (
    <Sheet title="Members" aside={String(g.members.length + 1)} flush>
      <ul className={styles.members}>
        <li className={styles.member}>
          <Person user={g.adviser} size="sm" sub="Research adviser" />
          <Badge tone="purple">Adviser</Badge>
        </li>
        {g.members.map((m) => (
          <li key={m.id} className={styles.member}>
            <Person user={m} size="sm" sub={`Joined ${fmtDate(m.addedAt)}`} />
            <span className={styles.memberTools}>
              {g.can.manage && m.groupRole !== 'mentor' ? (
                <SelectField
                  label={`Role for ${m.name}`}
                  value={m.groupRole}
                  onChange={(e) => setRole.mutate({ id: g.id, userId: m.id, role: e.target.value as GroupRole }, { onError: fail })}
                  className={styles.roleSelect}
                >
                  <option value="member">Member</option>
                  <option value="leader">Group leader</option>
                </SelectField>
              ) : (
                <Badge tone={m.groupRole === 'mentor' ? 'blue' : m.groupRole === 'leader' ? 'gold' : 'neutral'}>{seatLabel[m.groupRole]}</Badge>
              )}
              {g.can.manage && (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => window.confirm(`Remove ${m.name} from the group?`) && removeMember.mutate({ id: g.id, userId: m.id }, { onError: fail })}
                >
                  <UserMinus size={16} aria-hidden="true" />
                  <span className="sr-only">Remove {m.name}</span>
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {g.can.manage && (
        <div className={styles.addMember}>
          <PeoplePicker
            label="Add a member"
            roles={['student', 'educator']}
            exclude={[g.adviser.id, ...g.members.map((m) => m.id)]}
            hint="Students join as members; verified educators join as mentors."
            onPick={(u) => addMember.mutate({ id: g.id, userId: u.id }, { onSuccess: () => toast(`${u.name} added.`, 'success'), onError: fail })}
          />
        </div>
      )}
    </Sheet>
  );
}

// ---------- Activity ----------

function Activity({ items }: { items: GroupDetail['activity'] }) {
  return (
    <Sheet title="Activity" aside="Latest 40" flush>
      {items.length === 0 ? (
        <SheetEmpty>Member changes, files, deadlines, channels and announcements will be logged here.</SheetEmpty>
      ) : (
        <ol className={styles.list}>
          {items.map((a) => (
            <li key={a.id} className={styles.activity}>
              <Avatar name={a.actor.name} role={a.actor.role} photo={a.actor.photoUrl} size="sm" />
              <span className={styles.activityText}>{a.detail}</span>
              <time className={styles.rel} dateTime={a.createdAt} title={fmtDate(a.createdAt)}>
                {relTime(a.createdAt)}
              </time>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}

// ---------- Deadlines ----------

function Deadlines({ groupId, deadlines, organize }: { groupId: number; deadlines: GroupDetail['deadlines']; organize: boolean }) {
  const [title, setTitle] = useState('');
  const [due, setDue] = useState(() => isoDate(new Date(Date.now() + 7 * 86_400_000).toISOString()));
  const add = useAddDeadline();
  const remove = useDeleteDeadline();
  const toast = useToast();
  const now = Date.now();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(
      { id: groupId, title, dueAt: `${due}T23:59:00` },
      {
        onSuccess: () => {
          setTitle('');
          toast('Deadline added. Members have been notified.', 'success');
        },
        onError: (err) => toast(err.message, 'error'),
      },
    );
  };

  return (
    <Sheet title="Deadlines" aside={String(deadlines.length)} flush>
      {deadlines.length === 0 ? (
        <SheetEmpty>No deadlines yet.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {deadlines.map((d) => {
            const past = new Date(d.dueAt).getTime() < now;
            return (
              <li key={d.id} className={clsx(styles.deadline, past && styles.past)}>
                <time className={styles.due} dateTime={d.dueAt}>
                  {isoDate(d.dueAt)}
                </time>
                <span className={styles.deadlineText}>
                  <span className={styles.deadlineTitle}>{d.title}</span>
                  <span className={styles.rel}>{past ? `Was due ${relTime(d.dueAt)}` : `Due ${relTime(d.dueAt)}`}</span>
                </span>
                {organize && (
                  <button type="button" className={styles.iconButton} onClick={() => remove.mutate({ id: groupId, deadlineId: d.id })}>
                    <Trash2 size={16} aria-hidden="true" />
                    <span className="sr-only">Remove {d.title}</span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {organize && (
        <form className={styles.inlineForm} onSubmit={submit}>
          <TextField label="New deadline" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={3} maxLength={160} placeholder="e.g. Chapter 2 draft" className={styles.grow} />
          <TextField label="Due" type="date" value={due} onChange={(e) => setDue(e.target.value)} required />
          <Button type="submit" icon={<CalendarPlus size={16} aria-hidden="true" />} loading={add.isPending}>
            Add
          </Button>
        </form>
      )}
    </Sheet>
  );
}

// ---------- Files ----------

function Files({ groupId, files }: { groupId: number; files: GroupDetail['files'] }) {
  const upload = useUploadGroupFile();
  const remove = useDeleteGroupFile();
  const toast = useToast();
  return (
    <Sheet
      title="Shared files"
      aside={String(files.length)}
      flush
      actions={
        <label className={styles.upload}>
          <Plus size={16} aria-hidden="true" />
          {upload.isPending ? 'Uploading…' : 'Upload file'}
          <input
            type="file"
            className="sr-only"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (file) upload.mutate({ id: groupId, file }, { onSuccess: () => toast(`${file.name} shared.`, 'success'), onError: (err) => toast(err.message, 'error') });
            }}
          />
        </label>
      }
    >
      {files.length === 0 ? (
        <SheetEmpty>No files yet. Share drafts, templates and readings here or in the chat (up to 15 MB each).</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {files.map((f) => (
            <li key={f.id} className={styles.file}>
              <FileText size={20} aria-hidden="true" className={styles.fileIcon} />
              <span className={styles.fileText}>
                <a href={`/api/groups/${groupId}/files/${f.id}`} target="_blank" rel="noreferrer" className={styles.fileName}>
                  {f.name}
                </a>
                <span className={styles.rel}>
                  {fileSize(f.size)} · {f.uploadedBy.name} · {relTime(f.createdAt)}
                </span>
              </span>
              <a href={`/api/groups/${groupId}/files/${f.id}?download=1`} className={styles.iconButton}>
                <Download size={16} aria-hidden="true" />
                <span className="sr-only">Download {f.name}</span>
              </a>
              {f.canDelete && (
                <button
                  type="button"
                  className={styles.iconButton}
                  onClick={() => window.confirm(`Delete ${f.name}?`) && remove.mutate({ id: groupId, fileId: f.id }, { onError: (err) => toast(err.message, 'error') })}
                >
                  <Trash2 size={16} aria-hidden="true" />
                  <span className="sr-only">Delete {f.name}</span>
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
