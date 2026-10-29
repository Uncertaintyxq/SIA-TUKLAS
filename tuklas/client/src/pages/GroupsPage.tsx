/**
 * GroupsPage — /groups. The research groups you advise, mentor or belong to (all of them for admins).
 * Verified educators who hold the group moderation right start new ones.
 */
import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarClock, FileText, Plus, Users } from 'lucide-react';
import { useMe } from '../api/auth';
import { useCreateGroup, useGroups } from '../api/groups';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { TextAreaField, TextField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { fmtDate, plural } from '../lib/format';
import styles from './GroupsPage.module.css';

export function GroupsPage() {
  const { data: me } = useMe();
  const { data: groups, isPending } = useGroups();
  const [formKey, setFormKey] = useState(0);
  const [creating, setCreating] = useState(false);
  const canCreate = me?.role === 'educator' && me.rights.moderateGroups;

  return (
    <>
      <PageHeader
        title="Research groups"
        description="An adviser, their students and mentors in one place: chat channels, announcements, shared files and deadlines."
        actions={
          canCreate && (
            <Button
              variant="primary"
              icon={<Plus size={18} aria-hidden="true" />}
              onClick={() => {
                setFormKey((k) => k + 1);
                setCreating(true);
              }}
            >
              New group
            </Button>
          )
        }
      />
      {isPending ? (
        <div className={styles.grid}>
          <Skeleton className={styles.skeleton} />
        </div>
      ) : !groups?.length ? (
        <EmptyState title="No research groups yet">
          {canCreate ? 'Create a group for your advisees to chat, share files and track deadlines.' : 'When an adviser adds you to a research group, it appears here.'}
        </EmptyState>
      ) : (
        <div className={styles.grid}>
          {groups.map((g) => (
            <Link key={g.id} to={`/groups/${g.id}`} className={styles.card}>
              <span className={styles.name}>{g.name}</span>
              {g.description && <span className={styles.description}>{g.description}</span>}
              <span className={styles.adviser}>
                <Avatar name={g.adviser.name} role={g.adviser.role} photo={g.adviser.photoUrl} size="sm" />
                {g.adviser.name}
                {g.isAdviser && ' (you)'}
              </span>
              <span className={styles.facts}>
                <span>
                  <Users size={15} aria-hidden="true" />
                  {plural(g.memberCount, 'member')}
                </span>
                <span>
                  <FileText size={15} aria-hidden="true" />
                  {plural(g.fileCount, 'file')}
                </span>
                {g.nextDeadline && (
                  <span className={styles.deadline}>
                    <CalendarClock size={15} aria-hidden="true" />
                    {g.nextDeadline.title} · {fmtDate(g.nextDeadline.dueAt)}
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      )}
      {canCreate && <GroupForm key={formKey} open={creating} onClose={() => setCreating(false)} />}
    </>
  );
}

function GroupForm({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const create = useCreateGroup();
  const toast = useToast();
  const navigate = useNavigate();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { name, description },
      {
        onSuccess: ({ id }) => {
          toast('Group created. Add your students next.', 'success');
          onClose();
          navigate(`/groups/${id}`);
        },
      },
    );
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New research group"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="group-form" variant="primary" loading={create.isPending}>
            Create group
          </Button>
        </>
      }
    >
      <form id="group-form" className={styles.form} onSubmit={submit}>
        <TextField label="Group name" value={name} onChange={(e) => setName(e.target.value)} required minLength={3} maxLength={120} placeholder="e.g. Coastal Ecology Lab" />
        <TextAreaField label="What the group works on (optional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={1000} />
        {create.error && (
          <p className={styles.error} role="alert">
            {create.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
