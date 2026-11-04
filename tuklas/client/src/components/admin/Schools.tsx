/**
 * Schools — the admins' Schools tab (docs/decisions/0002): people who signed up without their
 * school's email domain, waiting to be confirmed; each school's list of departments; and for
 * super-admins every school on the site, with adding one and editing its name, email domains and
 * whether it takes signups.
 */
import { useState, type FormEvent } from 'react';
import { CircleCheck, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePatchUser } from '../../api/admin';
import { useMe } from '../../api/auth';
import {
  useAdminDepartments,
  useAdminInstitutions,
  useDeleteDepartment,
  useInstitutions,
  useSaveDepartment,
  useSaveInstitution,
  type AdminDepartment,
  type AdminInstitution,
} from '../../api/institutions';
import type { AdminQueue } from '../../types/admin';
import { relTime } from '../../lib/format';
import { Person } from '../people/Person';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Sheet, SheetEmpty } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import styles from './Schools.module.css';

/** People waiting for their school to confirm them. */
export function SchoolQueue({ people }: { people: AdminQueue['schools'] }) {
  const patch = usePatchUser();
  const toast = useToast();
  return (
    <Sheet title="People to confirm" aside="Signed up without a school email" flush>
      {people.length === 0 ? (
        <SheetEmpty>No one is waiting. People who sign up with their school email are in straight away.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {people.map((u) => (
            <li key={u.id} className={styles.row}>
              <div className={styles.body}>
                <Person user={u} sub={`${u.institution?.name ?? 'No school'} · ${u.program}`} />
                <span className={styles.meta}>
                  {u.email} · signed up {relTime(u.createdAt)}
                </span>
              </div>
              <Button
                variant="ok"
                icon={<CircleCheck size={16} aria-hidden="true" />}
                disabled={patch.isPending}
                onClick={() =>
                  patch.mutate(
                    { id: u.id, schoolConfirmed: true },
                    {
                      onSuccess: () => toast(`${u.name} is confirmed for ${u.institution?.name ?? 'their school'}.`, 'success'),
                      onError: (e) => toast(e.message, 'error'),
                    },
                  )
                }
              >
                Confirm
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

/** Super-admins: every school on the site. */
export function SchoolManager() {
  const { data, isPending } = useAdminInstitutions(true);
  const [editing, setEditing] = useState<AdminInstitution | 'new' | null>(null);
  return (
    <Sheet
      title="Schools on Tuklas"
      aside={data ? String(data.length) : undefined}
      flush
      actions={
        <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
          Add a school
        </Button>
      }
    >
      {isPending || !data ? (
        <Skeleton className={styles.skeleton} />
      ) : data.length === 0 ? (
        <SheetEmpty>No schools yet. Add one so people can sign up to it.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {data.map((s) => (
            <li key={s.id} className={styles.row}>
              <div className={styles.body}>
                <span className={styles.name}>
                  {s.name}
                  {s.shortName && <span className={styles.short}> ({s.shortName})</span>}
                  {!s.active && <Badge tone="neutral">Turned off</Badge>}
                </span>
                <span className={styles.meta}>
                  {s.emailDomains.length ? s.emailDomains.map((d) => `@${d}`).join(', ') : 'No email domain: every signup needs confirming'} ·{' '}
                  {s.people === 1 ? '1 person' : `${s.people} people`}
                </span>
              </div>
              <Button variant="ghost" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(s)}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      {editing && <SchoolForm key={editing === 'new' ? 'new' : editing.id} school={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

function SchoolForm({ school, onClose }: { school: AdminInstitution | null; onClose: () => void }) {
  const save = useSaveInstitution();
  const toast = useToast();
  const [name, setName] = useState(school?.name ?? '');
  const [shortName, setShortName] = useState(school?.shortName ?? '');
  const [domains, setDomains] = useState((school?.emailDomains ?? []).join(', '));
  const [active, setActive] = useState(school?.active ?? true);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const emailDomains = domains
      .split(/[\s,]+/)
      .map((d) => d.replace(/^@/, '').trim())
      .filter(Boolean);
    save.mutate(
      { id: school?.id, name, shortName, emailDomains, active },
      {
        onSuccess: () => {
          toast(school ? `${name} saved.` : `${name} added.`, 'success');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={school ? `Edit ${school.name}` : 'Add a school'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="school-form" variant="primary" loading={save.isPending}>
            {school ? 'Save' : 'Add school'}
          </Button>
        </>
      }
    >
      <form id="school-form" className={styles.form} onSubmit={submit}>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} maxLength={160} />
        <TextField
          label="Short name (optional)"
          hint="Shown on person cards, e.g. UIC."
          value={shortName}
          onChange={(e) => setShortName(e.target.value)}
          maxLength={40}
        />
        <TextField
          label="School email domains"
          hint="Separate with commas, e.g. school.edu.ph. Subdomains count too. People who sign up with these are in straight away; anyone else picks the school and waits for confirmation."
          value={domains}
          onChange={(e) => setDomains(e.target.value)}
        />
        {school && (
          <label className={styles.check}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            Takes new signups (turn off instead of deleting: its people and work stay)
          </label>
        )}
        {save.error && (
          <p className={styles.error} role="alert">
            {save.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}

/** Each school's departments: people pick theirs on their portfolio; feeds, follows and announcements use them. */
export function DepartmentManager() {
  const { data: me } = useMe();
  const { data: allSchools } = useInstitutions();
  // A school's admins keep their own school's list; super-admins pick any school
  const schools = me?.superAdmin ? allSchools : allSchools?.filter((s) => s.id === me?.institution?.id);
  const [picked, setPicked] = useState('');
  const school = Number(picked || schools?.[0]?.id || 0);
  const { data, isPending } = useAdminDepartments(school);
  const [editing, setEditing] = useState<AdminDepartment | 'new' | null>(null);
  const remove = useDeleteDepartment();
  const toast = useToast();
  return (
    <Sheet
      title="Departments"
      aside={data ? String(data.length) : undefined}
      flush
      actions={
        school > 0 && (
          <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setEditing('new')}>
            Add a department
          </Button>
        )
      }
    >
      {(schools?.length ?? 0) > 1 && (
        <div className={styles.filters}>
          <SelectField label="School" value={String(school || '')} onChange={(e) => setPicked(e.target.value)}>
            {schools!.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      {school === 0 ? (
        <SheetEmpty>Add a school first.</SheetEmpty>
      ) : isPending || !data ? (
        <Skeleton className={styles.skeleton} />
      ) : data.length === 0 ? (
        <SheetEmpty>No departments yet. Add them so people can pick theirs.</SheetEmpty>
      ) : (
        <ul className={styles.list}>
          {data.map((d) => (
            <li key={d.id} className={styles.row}>
              <div className={styles.body}>
                <span className={styles.name}>{d.name}</span>
                <span className={styles.meta}>{d.people === 1 ? '1 person' : `${d.people} people`}</span>
              </div>
              <Button variant="ghost" icon={<Pencil size={16} aria-hidden="true" />} onClick={() => setEditing(d)}>
                Rename
              </Button>
              {d.people === 0 && (
                <Button
                  variant="ghost"
                  icon={<Trash2 size={16} aria-hidden="true" />}
                  disabled={remove.isPending}
                  onClick={() =>
                    window.confirm(`Remove ${d.name}?`) &&
                    remove.mutate(d.id, { onSuccess: () => toast(`${d.name} removed.`), onError: (e) => toast(e.message, 'error') })
                  }
                >
                  Remove
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editing && (
        <DepartmentForm
          key={editing === 'new' ? 'new' : editing.id}
          school={school}
          department={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </Sheet>
  );
}

function DepartmentForm({ school, department, onClose }: { school: number; department: AdminDepartment | null; onClose: () => void }) {
  const save = useSaveDepartment();
  const toast = useToast();
  const [name, setName] = useState(department?.name ?? '');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: department?.id, institutionId: school, name },
      {
        onSuccess: () => {
          toast(department ? 'Department renamed.' : `${name} added.`, 'success');
          onClose();
        },
      },
    );
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={department ? `Rename ${department.name}` : 'Add a department'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="department-form" variant="primary" loading={save.isPending}>
            {department ? 'Save' : 'Add department'}
          </Button>
        </>
      }
    >
      <form id="department-form" className={styles.form} onSubmit={submit}>
        <TextField
          label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={160}
          placeholder="e.g. College of Computing"
        />
        {save.error && (
          <p className={styles.error} role="alert">
            {save.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
