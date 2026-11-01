/**
 * ReportDialog — report a work, comment, message, event or person to the admins: a reason, an
 * optional note, and what admins will see. useReport() gives a screen one dialog to open from many
 * places (every message in a chat); ReportButton is the one-off "Report" button.
 */
import { useState, type FormEvent } from 'react';
import { Flag } from 'lucide-react';
import { useSendReport } from '../../api/reports';
import type { ReportReason, ReportTarget } from '../../types/reports';
import { reportReasonLabel } from '../../lib/labels';
import { Button } from '../ui/Button';
import { TextAreaField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Notice } from '../ui/Notice';
import { useToast } from '../ui/Toast';
import styles from './ReportDialog.module.css';

export interface ReportSubject {
  type: ReportTarget;
  id: number;
  /** How the dialog names it: "this message", "“Title”", "Juan dela Cruz" */
  label: string;
}

const reasonsFor = (type: ReportTarget): ReportReason[] =>
  type === 'work' || type === 'comment' ? ['plagiarism', 'inappropriate', 'harassment', 'spam', 'privacy', 'other'] : ['harassment', 'inappropriate', 'spam', 'privacy', 'other'];

export function ReportDialog({ subject, onClose }: { subject: ReportSubject | null; onClose: () => void }) {
  return (
    <Modal open={subject !== null} onClose={onClose} title={subject ? `Report ${subject.label}` : 'Report'}>
      {/* Remount per subject, so the form starts empty each time */}
      {subject && <ReportForm key={`${subject.type}:${subject.id}`} subject={subject} onDone={onClose} />}
    </Modal>
  );
}

function ReportForm({ subject, onDone }: { subject: ReportSubject; onDone: () => void }) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const send = useSendReport();
  const toast = useToast();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    send.mutate(
      { type: subject.type, id: subject.id, reason, details: details.trim() || undefined },
      {
        onSuccess: () => {
          toast('Thanks. An admin will look at it, and you’ll hear what happened.', 'success');
          onDone();
        },
      },
    );
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <fieldset className={styles.reasons}>
        <legend className={styles.legend}>What’s wrong?</legend>
        {reasonsFor(subject.type).map((r) => (
          <label key={r} className={styles.reason}>
            <input type="radio" name="reason" value={r} checked={reason === r} onChange={() => setReason(r)} required />
            <span>{reportReasonLabel[r]}</span>
          </label>
        ))}
      </fieldset>
      <TextAreaField
        label="Anything an admin should know (optional)"
        value={details}
        onChange={(e) => setDetails(e.target.value)}
        rows={3}
        maxLength={500}
        hint={reason === 'plagiarism' ? 'Say where the original is, if you know.' : undefined}
        error={send.error?.message}
      />
      <Notice>
        Admins will see {subject.type === 'message' ? 'this message, even in a private chat,' : 'what you reported'} and who reported it. The person isn’t told who
        reported them.
      </Notice>
      <div className={styles.actions}>
        <Button onClick={onDone}>Cancel</Button>
        <Button type="submit" variant="danger" loading={send.isPending} disabled={!reason}>
          Send report
        </Button>
      </div>
    </form>
  );
}

/** One dialog for a screen, opened with report({type, id, label}). Render `dialog` once. */
export function useReport() {
  const [subject, setSubject] = useState<ReportSubject | null>(null);
  return { report: setSubject, dialog: <ReportDialog subject={subject} onClose={() => setSubject(null)} /> };
}

/** A quiet "Report" button with its own dialog, for pages about one thing (a work, an event, a person). */
export function ReportButton({ className, ...subject }: ReportSubject & { className?: string }) {
  const { report, dialog } = useReport();
  return (
    <>
      <Button variant="ghost" className={className} icon={<Flag size={16} aria-hidden="true" />} onClick={() => report(subject)}>
        Report
      </Button>
      {dialog}
    </>
  );
}
