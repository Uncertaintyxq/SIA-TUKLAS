/**
 * PortfolioForms — the modals for editing a portfolio's profile, links, background and honors.
 * Honors added by non-admins stay pending until the Office of Research verifies them.
 */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { AcademicLinkView, BackgroundView, HonorKind, HonorView, LinkType } from '@server/schemas/profile';
import { useRemovePhoto, useSaveBackground, useSaveHonor, useSaveLinks, useUpdateProfile, useUploadPhoto, type Portfolio } from '../../api/portfolio';
import { honorLabel, linkLabel } from '../../lib/labels';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { FileField, SelectField, TextAreaField, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import styles from './PortfolioForms.module.css';

// ---------- Shared form parts ----------

function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className={styles.error} role="alert">
      {message}
    </p>
  );
}

function Footer({ form, onClose, pending, label = 'Save' }: { form: string; onClose: () => void; pending: boolean; label?: string }) {
  return (
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button type="submit" form={form} variant="primary" loading={pending}>
        {label}
      </Button>
    </>
  );
}

// ---------- Profile ----------

/** Header and bios: name, titles, position, department, short and extended bio, photo. */
export function ProfileForm({ open, onClose, portfolio: p }: { open: boolean; onClose: () => void; portfolio: Portfolio }) {
  const [name, setName] = useState(p.user.name);
  const [titles, setTitles] = useState(p.titles);
  const [program, setProgram] = useState(p.user.program);
  const [department, setDepartment] = useState(p.user.department);
  const [headline, setHeadline] = useState(p.user.headline);
  const [bioLong, setBioLong] = useState(p.bioLong);
  const [photo, setPhoto] = useState<File | null>(null);
  const preview = useMemo(() => (photo ? URL.createObjectURL(photo) : null), [photo]);
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const update = useUpdateProfile();
  const uploadPhoto = useUploadPhoto();
  const removePhoto = useRemovePhoto();
  const toast = useToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await update.mutateAsync({ name, titles, program, department, headline, bioLong });
      if (photo) await uploadPhoto.mutateAsync(photo);
      toast('Portfolio saved.', 'success');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Edit profile" footer={<Footer form="profile-form" onClose={onClose} pending={pending} />}>
      <form id="profile-form" className={styles.form} onSubmit={submit}>
        <div className={styles.photoRow}>
          <Avatar name={name || p.user.name} role={p.user.role} photo={preview ?? p.user.photoUrl} size="lg" />
          <div className={styles.photoTools}>
            <FileField label="Profile photo" accept="image/png,image/jpeg,image/webp" file={photo} onFile={setPhoto} buttonLabel="Choose photo" hint="PNG, JPEG or WebP, up to 5 MB." />
            {p.user.photoUrl && !photo && (
              <Button variant="ghost" onClick={() => removePhoto.mutate(undefined, { onSuccess: () => toast('Photo removed.') })} loading={removePhoto.isPending}>
                Remove current photo
              </Button>
            )}
          </div>
        </div>
        <div className={styles.row}>
          <TextField label="Full name" value={name} onChange={(e) => setName(e.target.value)} required autoComplete="name" />
          <TextField label="Titles" value={titles} onChange={(e) => setTitles(e.target.value)} placeholder="e.g. PhD, MA" hint="Shown after your name." />
        </div>
        <div className={styles.row}>
          <TextField label="Program or position" value={program} onChange={(e) => setProgram(e.target.value)} required placeholder="e.g. BS Biology · 4th year" />
          <TextField label="Department" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. College of Computing" />
        </div>
        <TextField label="Short bio" value={headline} onChange={(e) => setHeadline(e.target.value)} maxLength={160} hint={`One line under your name. ${headline.length}/160`} />
        <TextAreaField label="Extended bio" value={bioLong} onChange={(e) => setBioLong(e.target.value)} rows={7} maxLength={5000} hint="Research interests, projects and goals. Leave a blank line between paragraphs." />
        <FormError message={error} />
      </form>
    </Modal>
  );
}

// ---------- Academic links ----------

type LinkRow =Omit<AcademicLinkView, 'id'> & { key: number };
let nextKey = 1;

/** Edits the whole list of academic links at once, up to 12. */
export function LinksForm({ open, onClose, links }: { open: boolean; onClose: () => void; links: AcademicLinkView[] }) {
  const [rows, setRows] = useState<LinkRow[]>(() => links.map((l) => ({ type: l.type, url: l.url, label: l.label, key: nextKey++ })));
  const save = useSaveLinks();
  const toast = useToast();
  const used = new Set(rows.map((r) => r.type));
  const firstFree = (Object.keys(linkLabel) as LinkType[]).find((t) => t === 'other' || !used.has(t)) ?? 'other';
  const set = (key: number, patch: Partial<LinkRow>) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { links: rows.map(({ type, url, label }) => ({ type, url: url.trim(), label })) },
      {
        onSuccess: () => {
          toast('Links saved.', 'success');
          onClose();
        },
      },
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Academic links" footer={<Footer form="links-form" onClose={onClose} pending={save.isPending} />}>
      <form id="links-form" className={styles.form} onSubmit={submit}>
        {rows.length === 0 && <p className={styles.hint}>No links yet. Add your Google Scholar, ORCID, ResearchGate, LinkedIn or faculty page.</p>}
        {rows.map((r) => (
          <fieldset key={r.key} className={styles.linkRow}>
            <legend className="sr-only">{linkLabel[r.type]} link</legend>
            <SelectField label="Site" value={r.type} onChange={(e) => set(r.key, { type: e.target.value as LinkType })} className={styles.linkType}>
              {(Object.keys(linkLabel) as LinkType[]).map((t) => (
                <option key={t} value={t}>
                  {linkLabel[t]}
                </option>
              ))}
            </SelectField>
            <TextField label="Address" type="url" value={r.url} onChange={(e) => set(r.key, { url: e.target.value })} placeholder="https://" required className={styles.linkUrl} />
            {r.type === 'other' && <TextField label="Label" value={r.label} onChange={(e) => set(r.key, { label: e.target.value })} maxLength={80} className={styles.linkLabel} />}
            <button type="button" className={styles.removeRow} onClick={() => setRows((list) => list.filter((x) => x.key !== r.key))}>
              <Trash2 size={16} aria-hidden="true" />
              <span className="sr-only">Remove this link</span>
            </button>
          </fieldset>
        ))}
        <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => setRows((list) => [...list, { type: firstFree, url: '', label: '', key: nextKey++ }])} disabled={rows.length >= 12}>
          Add link
        </Button>
        <FormError message={save.error?.message} />
      </form>
    </Modal>
  );
}

// ---------- Background and honors ----------

/** Adds or edits one academic background entry. */
export function BackgroundForm({ open, onClose, row }: { open: boolean; onClose: () => void; row?: BackgroundView }) {
  const [degree, setDegree] = useState(row?.degree ?? '');
  const [school, setSchool] = useState(row?.school ?? '');
  const [year, setYear] = useState(row?.year ?? '');
  const save = useSaveBackground();
  const toast = useToast();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: row?.id, degree, school, year },
      {
        onSuccess: () => {
          toast(row ? 'Updated.' : 'Added to your academic background.', 'success');
          onClose();
        },
      },
    );
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? 'Edit academic background' : 'Add academic background'}
      footer={<Footer form="background-form" onClose={onClose} pending={save.isPending} label={row ? 'Save' : 'Add'} />}
    >
      <form id="background-form" className={styles.form} onSubmit={submit}>
        <TextField label="Degree or diploma" value={degree} onChange={(e) => setDegree(e.target.value)} required placeholder="BS Computer Science" />
        <div className={styles.row}>
          <TextField label="School" value={school} onChange={(e) => setSchool(e.target.value)} required />
          <TextField label="Year" value={year} onChange={(e) => setYear(e.target.value)} required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} placeholder="2027" className={styles.year} />
        </div>
        <FormError message={save.error?.message} />
      </form>
    </Modal>
  );
}

/** Adds or edits one honor, grant or certification. */
export function HonorForm({ open, onClose, row, isAdmin }: { open: boolean; onClose: () => void; row?: HonorView; isAdmin: boolean }) {
  const [kind, setKind] = useState<HonorKind>(row?.kind ?? 'award');
  const [title, setTitle] = useState(row?.title ?? '');
  const [issuer, setIssuer] = useState(row?.issuer ?? '');
  const [year, setYear] = useState(row?.year ?? '');
  const save = useSaveHonor();
  const toast = useToast();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: row?.id, kind, title, issuer, year },
      {
        onSuccess: () => {
          toast(isAdmin ? 'Saved.' : 'Saved. It shows as pending until the Office of Research verifies it.', 'success');
          onClose();
        },
      },
    );
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? 'Edit honor' : 'Add honor, grant or certification'}
      footer={<Footer form="honor-form" onClose={onClose} pending={save.isPending} label={row ? 'Save' : 'Add'} />}
    >
      <form id="honor-form" className={styles.form} onSubmit={submit}>
        <div className={styles.row}>
          <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as HonorKind)}>
            {(Object.keys(honorLabel) as HonorKind[]).map((k) => (
              <option key={k} value={k}>
                {honorLabel[k]}
              </option>
            ))}
          </SelectField>
          <TextField label="Year" value={year} onChange={(e) => setYear(e.target.value)} required inputMode="numeric" pattern="[0-9]{4}" maxLength={4} className={styles.year} />
        </div>
        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <TextField label="Given by" value={issuer} onChange={(e) => setIssuer(e.target.value)} required />
        <p className={styles.hint}>
          {isAdmin
            ? 'Admin entries are verified automatically.'
            : 'New and edited honors show as “Pending verification” until the Office of Research verifies them. Only verified honors are public.'}
        </p>
        <FormError message={save.error?.message} />
      </form>
    </Modal>
  );
}
