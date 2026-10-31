/**
 * EntryForm — the modal where students create, edit and submit works for adviser review.
 * Saves the entry, uploads the PDF, then submits; a work needing revision is resubmitted here.
 */
import { useState, type FormEvent } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import type { UserCard } from '../../types/common';
import type { WorkStatus, WorkType } from '../../types/works';
import { useMe } from '../../api/auth';
import { useAdvisers } from '../../api/portfolio';
import { useCreateWork, useSubmitWork, useUpdateWork, useUploadWorkPdf, type WorkCard } from '../../api/works';
import { typeLabel } from '../../lib/labels';
import { Person } from '../people/Person';
import { PeoplePicker } from '../people/PeoplePicker';
import { Button } from '../ui/Button';
import { FileField, SelectField, TextAreaField, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Notice } from '../ui/Notice';
import { useToast } from '../ui/Toast';
import { TopicOverlap } from './TopicOverlap';
import styles from './EntryForm.module.css';

/** What the form needs from an existing work to edit it. */
export type EditableWork = Pick<WorkCard, 'id' | 'type' | 'title' | 'abstract' | 'tags' | 'authors' | 'adviser' | 'status'> & { pdfName?: string | null; hasPdf?: boolean };

/**
 * The "New entry" form, also used to edit a draft and to revise and resubmit.
 * Mount it with a fresh `key` each time it opens so it starts from the work's current values.
 */
export function EntryForm({ open, onClose, work, onSaved }: { open: boolean; onClose: () => void; work?: EditableWork; onSaved?: (id: number) => void }) {
  const { data: me } = useMe();
  const { data: advisers = [] } = useAdvisers();
  const create = useCreateWork();
  const update = useUpdateWork();
  const uploadPdf = useUploadWorkPdf();
  const submitWork = useSubmitWork();
  const toast = useToast();

  const [type, setType] = useState<WorkType>(work?.type ?? 'research');
  const [adviserId, setAdviserId] = useState<number>(work?.adviser.id ?? 0);
  const [title, setTitle] = useState(work?.title ?? '');
  const [abstract, setAbstract] = useState(work?.abstract ?? '');
  const [keywords, setKeywords] = useState(work?.tags.join(', ') ?? '');
  const [coAuthors, setCoAuthors] = useState<UserCard[]>(work?.authors.slice(1) ?? []);
  const [pdf, setPdf] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);

  const status: WorkStatus = work?.status ?? 'draft';
  const resubmitting = status === 'revision';
  const choices = advisers.filter((a) => a.id !== me?.id && !coAuthors.some((c) => c.id === a.id));
  const tags = keywords.split(',').map((t) => t.trim()).filter(Boolean);

  const save = async (submit: boolean) => {
    setError(null);
    if (!adviserId) {
      setError('Choose a research adviser.');
      return;
    }
    setBusy(submit ? 'submit' : 'draft');
    try {
      const payload = { type, title, abstract, tags, adviserId, coAuthorIds: coAuthors.map((c) => c.id) };
      let id = work?.id;
      if (id) await update.mutateAsync({ id, ...payload });
      else id = (await create.mutateAsync({ ...payload, submit: false })).id;
      if (pdf) await uploadPdf.mutateAsync({ id, file: pdf });
      if (submit) await submitWork.mutateAsync({ id, note });
      toast(
        submit ? (resubmitting ? 'Resubmitted. Your adviser has been notified.' : 'Submitted. Your adviser will review it.') : 'Draft saved. Only you can see it.',
        'success',
      );
      onSaved?.(id);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void save(true);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={resubmitting ? 'Revise & resubmit' : work ? 'Edit entry' : 'New entry'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          {!resubmitting && (
            <Button onClick={() => void save(false)} loading={busy === 'draft'} disabled={busy !== null}>
              Save draft
            </Button>
          )}
          <Button type="submit" form="entry-form" variant="primary" loading={busy === 'submit'} disabled={busy !== null}>
            {resubmitting ? 'Resubmit for review' : 'Submit for adviser review'}
          </Button>
        </>
      }
    >
      <form id="entry-form" className={styles.form} onSubmit={onSubmit}>
        <Notice icon={<ShieldCheck size={18} aria-hidden="true" />}>
          Your work stays private until your research adviser or the academic panel approves it.
        </Notice>

        <div className={styles.row}>
          <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as WorkType)}>
            {Object.entries(typeLabel).map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Research adviser"
            value={adviserId || ''}
            onChange={(e) => setAdviserId(Number(e.target.value))}
            hint={advisers.length === 0 ? 'No verified advisers yet.' : undefined}
            required
          >
            <option value="" disabled>
              Choose an adviser
            </option>
            {choices.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </SelectField>
        </div>

        <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={180} />
        <TextField
          label="Keywords"
          value={keywords}
          onChange={(e) => setKeywords(e.target.value)}
          placeholder="Separate with commas, e.g. IoT, Flood warning"
          hint={tags.length > 10 ? 'Use at most 10 keywords.' : undefined}
        />
        <TopicOverlap title={title} keywords={keywords} exclude={work?.id} />
        <TextAreaField label="Abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} required minLength={30} maxLength={6000} rows={7} />

        <div className={styles.coauthors}>
          <PeoplePicker
            label="Co-authors (optional)"
            roles={['student', 'educator']}
            exclude={[me?.id ?? 0, adviserId, ...coAuthors.map((c) => c.id)]}
            onPick={(u) => setCoAuthors((list) => [...list, u])}
          />
          {coAuthors.length > 0 && (
            <ol className={styles.chosen} aria-label="Co-authors in byline order">
              {coAuthors.map((c) => (
                <li key={c.id} className={styles.chosenItem}>
                  <Person user={c} link={false} size="sm" />
                  <button type="button" className={styles.remove} onClick={() => setCoAuthors((list) => list.filter((x) => x.id !== c.id))}>
                    <X size={16} aria-hidden="true" />
                    <span className="sr-only">Remove {c.name}</span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>

        <FileField
          label="PDF of the full work"
          accept="application/pdf"
          file={pdf}
          onFile={setPdf}
          buttonLabel={work?.hasPdf ? 'Replace PDF' : 'Choose PDF'}
          hint={work?.hasPdf ? `Current: ${work.pdfName ?? 'work.pdf'}. Each submitted version keeps its own PDF.` : 'Up to 20 MB. You can add it later.'}
        />

        {resubmitting && (
          <TextField label="What changed in this version?" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="e.g. Cut the market scene and tightened paragraphs 3–5" />
        )}

        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
      </form>
    </Modal>
  );
}
