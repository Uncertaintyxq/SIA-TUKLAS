/**
 * DeliverablePanel — one deliverable in a research group: its instructions, the student's hand-in
 * form and their submission with its earlier versions, and for the adviser and mentors everyone's work
 * with accept / revise.
 * What the viewer may do comes from the server (`can`); students only ever get their own work back.
 */
import { useState, type FormEvent } from 'react';
import { Check, Download, FileText, History, RotateCcw, Upload, X } from 'lucide-react';
import type { DeliverableVersion, SubmissionMode, SubmissionStatus } from '../../types/groups';
import { useDeliverable, useHandIn, useReviewSubmission, type DeliverableDetail, type DeliverableSubmission } from '../../api/groups';
import { Person } from '../people/Person';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { FileField, TextAreaField } from '../ui/Field';
import { Notice } from '../ui/Notice';
import { Sheet, SheetEmpty } from '../ui/Sheet';
import { Skeleton } from '../ui/Skeleton';
import { useToast } from '../ui/Toast';
import { fileSize, fmtDateTime, relTime } from '../../lib/format';
import styles from './DeliverablePanel.module.css';

export const statusLabel: Record<SubmissionStatus, string> = { submitted: 'Handed in', needs_revision: 'Revision asked', accepted: 'Accepted' };
export const statusTone: Record<SubmissionStatus, BadgeTone> = { submitted: 'gold', needs_revision: 'warn', accepted: 'ok' };
export const modeLabel: Record<Exclude<SubmissionMode, 'none'>, string> = {
  each: 'Each student hands in their own work',
  group: 'One submission for the whole group',
};

export function DeliverablePanel({ groupId, deadlineId, onClose }: { groupId: number; deadlineId: number; onClose: () => void }) {
  const { data: d, isPending, error } = useDeliverable(groupId, deadlineId);

  return (
    <Sheet
      title={d?.title ?? 'Deliverable'}
      aside={d ? `Due ${fmtDateTime(d.dueAt)}` : undefined}
      actions={
        <Button variant="ghost" icon={<X size={16} aria-hidden="true" />} onClick={onClose}>
          Close
        </Button>
      }
    >
      {isPending ? (
        <Skeleton />
      ) : error ? (
        <p className={styles.error} role="alert">
          {error.message}
        </p>
      ) : (
        <div className={styles.panel}>
          {d.submissionMode !== 'none' && <p className={styles.mode}>{modeLabel[d.submissionMode]}</p>}
          {d.instructions && <p className={styles.instructions}>{d.instructions}</p>}
          {d.mine && <SubmissionCard groupId={groupId} deliverable={d} submission={d.mine} />}
          {d.can.submit && <HandInForm groupId={groupId} deliverable={d} />}
          {d.can.review && <ReviewList groupId={groupId} deliverable={d} />}
        </div>
      )}
    </Sheet>
  );
}

function HandInForm({ groupId, deliverable: d }: { groupId: number; deliverable: DeliverableDetail }) {
  const handIn = useHandIn();
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState('');
  const again = d.mine !== null;
  const late = new Date(d.dueAt).getTime() < Date.now();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    handIn.mutate(
      { groupId, deadlineId: d.id, file, note },
      {
        onSuccess: () => {
          setFile(null);
          setNote('');
          toast(again ? 'Handed in again. Your reviewers have been told.' : 'Handed in. Your reviewers have been told.', 'success');
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <h3 className={styles.heading}>{again ? 'Hand in a new version' : 'Hand in your work'}</h3>
      <p className={styles.muted}>
        {again ? 'The review starts again. Your earlier versions and their feedback stay below the submission. ' : ''}
        The group sees “handed in” in #general, but never your file or note.
      </p>
      {late && <Notice tone="warn">The due date has passed. You can still hand in, and it will be marked late.</Notice>}
      <FileField label="File" hint="PDF, Word, slides or any file up to 15 MB." file={file} onFile={setFile} />
      <TextAreaField label="Note to your reviewers (optional)" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
      {handIn.error && (
        <p className={styles.error} role="alert">
          {handIn.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <Button type="submit" variant="primary" icon={<Upload size={16} aria-hidden="true" />} loading={handIn.isPending} disabled={!file}>
          {again ? 'Hand in again' : 'Hand in'}
        </Button>
      </div>
    </form>
  );
}

function ReviewList({ groupId, deliverable: d }: { groupId: number; deliverable: DeliverableDetail }) {
  const submissions = d.submissions ?? [];
  const missing = d.missing ?? [];
  const past = new Date(d.dueAt).getTime() < Date.now();

  return (
    <section className={styles.review} aria-label="Submissions">
      <h3 className={styles.heading}>
        {d.submissionMode === 'group' ? 'The group’s submission' : `Handed in: ${submissions.length} of ${submissions.length + missing.length}`}
      </h3>
      {submissions.length === 0 && <SheetEmpty>Nothing handed in yet.</SheetEmpty>}
      {submissions.map((s) => (
        <SubmissionCard key={s.id} groupId={groupId} deliverable={d} submission={s} reviewing />
      ))}
      {d.submissionMode === 'each' && missing.length > 0 && (
        <div className={styles.missing}>
          <h4 className={styles.subheading}>{past ? 'Missing' : 'Not handed in yet'}</h4>
          <ul className={styles.people}>
            {missing.map((u) => (
              <li key={u.id}>
                <Person user={u} size="sm" />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function SubmissionCard({ groupId, deliverable: d, submission: s, reviewing = false }: { groupId: number; deliverable: DeliverableDetail; submission: DeliverableSubmission; reviewing?: boolean }) {
  return (
    <article className={styles.card}>
      <header className={styles.cardHead}>
        {reviewing || d.submissionMode === 'group' ? <Person user={s.submittedBy} size="sm" sub={`Handed in ${relTime(s.submittedAt)}`} /> : <span className={styles.muted}>Handed in {relTime(s.submittedAt)}</span>}
        <span className={styles.badges}>
          {s.late && <Badge tone="bad">Late</Badge>}
          <Badge tone={statusTone[s.status]}>{statusLabel[s.status]}</Badge>
        </span>
      </header>
      <div className={styles.file}>
        <FileText size={20} aria-hidden="true" className={styles.fileIcon} />
        <span className={styles.fileText}>
          <a href={s.fileUrl} target="_blank" rel="noreferrer" className={styles.fileName}>
            {s.name}
          </a>
          <span className={styles.muted}>
            {fileSize(s.size)} · version {s.version} · {fmtDateTime(s.submittedAt)}
          </span>
        </span>
        <a href={`${s.fileUrl}?download=1`} className={styles.iconButton}>
          <Download size={16} aria-hidden="true" />
          <span className="sr-only">Download {s.name}</span>
        </a>
      </div>
      {s.note && (
        <blockquote className={styles.note}>
          <span className={styles.label}>Note</span>
          {s.note}
        </blockquote>
      )}
      {s.feedback && (
        <blockquote className={styles.feedback}>
          <span className={styles.label}>
            Feedback{s.reviewedBy ? ` from ${s.reviewedBy.name}` : ''}
            {s.reviewedAt ? ` · ${relTime(s.reviewedAt)}` : ''}
          </span>
          {s.feedback}
        </blockquote>
      )}
      {s.history.length > 0 && <EarlierVersions versions={s.history} />}
      {reviewing && <ReviewForm groupId={groupId} deadlineId={d.id} submission={s} />}
    </article>
  );
}

function EarlierVersions({ versions }: { versions: DeliverableVersion[] }) {
  return (
    <details className={styles.history}>
      <summary className={styles.historySummary}>
        <History size={16} aria-hidden="true" />
        Earlier versions ({versions.length})
      </summary>
      <ol className={styles.versions}>
        {versions.map((v) => (
          <li key={v.version} className={styles.version}>
            <div className={styles.versionHead}>
              <a href={v.fileUrl} target="_blank" rel="noreferrer" className={styles.fileName}>
                Version {v.version}: {v.name}
              </a>
              <span className={styles.badges}>
                {v.late && <Badge tone="bad">Late</Badge>}
                <Badge tone={statusTone[v.status]}>{statusLabel[v.status]}</Badge>
              </span>
            </div>
            <span className={styles.muted}>
              {fileSize(v.size)} · {v.submittedBy ? `${v.submittedBy.name} · ` : ''}
              {fmtDateTime(v.submittedAt)}
            </span>
            {v.note && (
              <blockquote className={styles.note}>
                <span className={styles.label}>Note</span>
                {v.note}
              </blockquote>
            )}
            {v.feedback && (
              <blockquote className={styles.feedback}>
                <span className={styles.label}>
                  Feedback{v.reviewedBy ? ` from ${v.reviewedBy.name}` : ''}
                  {v.reviewedAt ? ` · ${relTime(v.reviewedAt)}` : ''}
                </span>
                {v.feedback}
              </blockquote>
            )}
          </li>
        ))}
      </ol>
    </details>
  );
}

function ReviewForm({ groupId, deadlineId, submission: s }: { groupId: number; deadlineId: number; submission: DeliverableSubmission }) {
  const review = useReviewSubmission();
  const toast = useToast();
  const [feedback, setFeedback] = useState('');

  const decide = (status: 'accepted' | 'needs_revision') =>
    review.mutate(
      { groupId, deadlineId, submissionId: s.id, status, feedback },
      {
        onSuccess: () => {
          setFeedback('');
          toast(status === 'accepted' ? 'Accepted. The student has been told.' : 'Revision asked. The student has been told.', 'success');
        },
      },
    );

  return (
    <div className={styles.reviewForm}>
      <TextAreaField
        label={s.status === 'submitted' ? 'Feedback' : 'New feedback'}
        hint="Needed when you ask for a revision."
        rows={3}
        maxLength={4000}
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
      />
      {review.error && (
        <p className={styles.error} role="alert">
          {review.error.message}
        </p>
      )}
      <div className={styles.actions}>
        <Button variant="ok" icon={<Check size={16} aria-hidden="true" />} loading={review.isPending && review.variables?.status === 'accepted'} disabled={review.isPending} onClick={() => decide('accepted')}>
          Accept
        </Button>
        <Button icon={<RotateCcw size={16} aria-hidden="true" />} loading={review.isPending && review.variables?.status === 'needs_revision'} disabled={review.isPending || !feedback.trim()} onClick={() => decide('needs_revision')}>
          Ask for a revision
        </Button>
      </div>
    </div>
  );
}
