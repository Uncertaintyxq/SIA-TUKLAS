/**
 * PublicationEditorPage — /publications/new and /publications/:id/edit. Educators draft and publish
 * their research: title, abstract, keywords, co-authors, methodology, full text and a PDF, then choose
 * Draft, Internal (institution only) or Public. Publishing needs the right an admin grants.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Globe, Lock, Save, School, X } from 'lucide-react';
import type { UserCard } from '@server/schemas/common';
import { useMe } from '../api/auth';
import {
  useCreatePublication,
  usePublication,
  useRemovePublicationPdf,
  useUpdatePublication,
  useUploadPublicationPdf,
  type PublicationDetail,
  type PublicationVisibility,
} from '../api/publications';
import { PageHeader } from '../components/layout/PageHeader';
import { Person } from '../components/people/Person';
import { PeoplePicker } from '../components/people/PeoplePicker';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { FileField, TextAreaField, TextField } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { Sheet } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import styles from './PublicationEditorPage.module.css';

export function PublicationEditorPage() {
  const id = Number(useParams().id) || 0;
  const { data, isPending, error } = usePublication(id);
  if (!id) return <Editor />;
  if (isPending) return <Skeleton className={styles.loading} />;
  if (error || !data?.can.edit)
    return (
      <EmptyState title="You can’t edit this research" action={<ButtonLink to="/research">My research</ButtonLink>}>
        Only its main author can edit it.
      </EmptyState>
    );
  return <Editor existing={data} />;
}

const visibilityChoices: { value: PublicationVisibility; label: string; note: string; icon: typeof Lock }[] = [
  { value: 'draft', label: 'Draft', note: 'Only you and your co-authors can see it.', icon: Lock },
  { value: 'internal', label: 'Internal', note: 'Everyone signed in to Tuklas: students, educators, admins.', icon: School },
  { value: 'public', label: 'Public', note: 'Anyone with the link, and your public portfolio.', icon: Globe },
];

function Editor({ existing }: { existing?: PublicationDetail }) {
  const { data: me } = useMe();
  const [title, setTitle] = useState(existing?.title ?? '');
  const [abstract, setAbstract] = useState(existing?.abstract ?? '');
  const [keywords, setKeywords] = useState(existing?.keywords.join(', ') ?? '');
  const [methodology, setMethodology] = useState(existing?.methodology ?? '');
  const [fullText, setFullText] = useState(existing?.fullText ?? '');
  const [coAuthors, setCoAuthors] = useState<UserCard[]>(existing?.authors.slice(1) ?? []);
  const [visibility, setVisibility] = useState<PublicationVisibility>(existing?.visibility ?? 'draft');
  const [pdf, setPdf] = useState<File | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const create = useCreatePublication();
  const update = useUpdatePublication();
  const uploadPdf = useUploadPublicationPdf();
  const removePdf = useRemovePublicationPdf();
  const toast = useToast();
  const navigate = useNavigate();

  const canPublish = existing ? existing.can.publish : Boolean(me?.rights.publish);
  const tags = keywords.split(',').map((t) => t.trim()).filter(Boolean);
  const busy = create.isPending || update.isPending || uploadPdf.isPending;

  const save = async (e: FormEvent) => {
    e.preventDefault();
    setProblem(null);
    if (title.trim().length < 5) return setProblem('Give the research a title of at least 5 characters.');
    if (abstract.trim().length < 30) return setProblem('Write an abstract of at least 30 characters.');
    if (tags.length > 10) return setProblem('Use at most 10 keywords.');
    const input = { title, abstract, keywords: tags, methodology, fullText, coAuthorIds: coAuthors.map((c) => c.id), visibility };
    try {
      let id = existing?.id;
      if (id) await update.mutateAsync({ id, ...input });
      else id = (await create.mutateAsync(input)).id;
      if (pdf) await uploadPdf.mutateAsync({ id, file: pdf });
      toast(visibility === 'draft' ? 'Draft saved.' : visibility === 'public' ? 'Published for everyone.' : 'Published to the institution.', 'success');
      navigate(`/publications/${id}`);
    } catch (err) {
      setProblem((err as Error).message);
    }
  };

  return (
    <>
      <PageHeader
        title={existing ? 'Edit research' : 'New research'}
        description="Draft your research here, then publish it to the institution or to everyone. Students can read and cite it in the research library."
      />
      <form className={styles.layout} onSubmit={save} noValidate>
        <div className={styles.main}>
          <Sheet title="The research">
            <div className={styles.fields}>
              <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
              <TextAreaField label="Abstract" value={abstract} onChange={(e) => setAbstract(e.target.value)} required maxLength={6000} rows={6} />
              <TextField
                label="Keywords"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                placeholder="e.g. Disaster Risk Reduction, Early Warning Systems"
                hint={tags.length > 10 ? 'Use at most 10 keywords.' : 'Separate keywords with commas.'}
              />
            </div>
          </Sheet>

          <Sheet title="Methodology">
            <TextAreaField
              label="How the research was done"
              value={methodology}
              onChange={(e) => setMethodology(e.target.value)}
              maxLength={20000}
              rows={7}
              placeholder="Design, participants or data, instruments, and analysis."
            />
          </Sheet>

          <Sheet title="Full text">
            <div className={styles.fields}>
              <TextAreaField
                label="Full text (optional)"
                value={fullText}
                onChange={(e) => setFullText(e.target.value)}
                maxLength={200000}
                rows={14}
                hint="Leave a blank line between paragraphs. You can upload a PDF instead, or as well."
              />
              <FileField
                label="PDF"
                accept="application/pdf"
                file={pdf}
                onFile={setPdf}
                buttonLabel={existing?.pdfName ? 'Replace PDF' : 'Choose PDF'}
                hint={existing?.pdfName ? `Current: ${existing.pdfName}` : 'Up to 20 MB.'}
              />
              {existing?.pdfName && !pdf && (
                <Button
                  variant="ghost"
                  className={styles.removePdf}
                  disabled={removePdf.isPending}
                  onClick={() => removePdf.mutate(existing.id, { onSuccess: () => toast('PDF removed.'), onError: (e) => toast(e.message, 'error') })}
                >
                  Remove the current PDF
                </Button>
              )}
            </div>
          </Sheet>
        </div>

        <aside className={styles.side}>
          <Sheet title="Visibility">
            <fieldset className={styles.choices}>
              <legend className="sr-only">Who can read it</legend>
              {visibilityChoices.map((c) => {
                const locked = c.value !== 'draft' && !canPublish;
                return (
                  <label key={c.value} className={styles.choice} data-checked={visibility === c.value || undefined} data-locked={locked || undefined}>
                    <input type="radio" name="visibility" value={c.value} checked={visibility === c.value} disabled={locked} onChange={() => setVisibility(c.value)} />
                    <c.icon size={18} aria-hidden="true" className={styles.choiceIcon} />
                    <span className={styles.choiceText}>
                      <span className={styles.choiceLabel}>{c.label}</span>
                      <span className={styles.choiceNote}>{c.note}</span>
                    </span>
                  </label>
                );
              })}
            </fieldset>
            {!canPublish && (
              <Notice tone="warn" className={styles.rightNotice}>
                {me?.verified ? 'An admin has turned off your publishing right, so you can save drafts only.' : 'An admin needs to verify your educator account before you can publish.'}
              </Notice>
            )}
          </Sheet>

          <Sheet title="Co-authors">
            <div className={styles.fields}>
              <PeoplePicker
                label="Add a co-author"
                roles={['student', 'educator']}
                exclude={[me?.id ?? 0, ...coAuthors.map((c) => c.id)]}
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
          </Sheet>

          {problem && <Notice tone="bad">{problem}</Notice>}
          <div className={styles.actions}>
            <Button type="submit" variant="primary" size="lg" block icon={<Save size={18} aria-hidden="true" />} loading={busy}>
              {visibility === 'draft' ? 'Save draft' : existing?.visibility === visibility ? 'Save changes' : 'Publish'}
            </Button>
            <ButtonLink to={existing ? `/publications/${existing.id}` : '/research'} variant="ghost" block>
              Cancel
            </ButtonLink>
          </div>
        </aside>
      </form>
    </>
  );
}
