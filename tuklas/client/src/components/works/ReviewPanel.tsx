/**
 * ReviewPanel — the review side of a work page: the adviser's decision, the review history and the private thread.
 * Each part renders only for people the work's `can` flags allow.
 */
import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { CheckCheck, CircleCheck, FileText, PenLine, Send } from 'lucide-react';
import type { ReviewDecision, WorkDetail } from '../../types/works';
import { useDecision, usePatchItem, useReviewComment } from '../../api/works';
import { fmtDate, relTime } from '../../lib/format';
import { decisionLabel } from '../../lib/labels';
import { Person } from '../people/Person';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TextAreaField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Notice } from '../ui/Notice';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import styles from './ReviewPanel.module.css';

// ---------- Decision ----------

/** What the adviser (or the panel) can do with a work right now. */
export function DecisionBox({ work, onApproved }: { work: WorkDetail; onApproved: () => void }) {
  const decide = useDecision();
  const toast = useToast();
  const [returning, setReturning] = useState(false);
  const allowed = work.can.decide;
  if (allowed.length === 0) return null;

  const run = (decision: ReviewDecision, extra: { comment?: string; items?: string[] } = {}, done?: () => void) =>
    decide.mutate(
      { id: work.id, decision, ...extra },
      {
        onSuccess: () => {
          done?.();
          if (decision === 'approve') onApproved();
          toast(
            {
              start_review: 'Review started. The author can see it’s under review.',
              revise: 'Returned with comments. The author has been notified.',
              approve: 'Approved. It’s now public on the feed and portfolios.',
              reject: 'Marked as not approved.',
            }[decision],
            decision === 'reject' ? 'info' : 'success',
          );
        },
        onError: (e) => toast(e.message, 'error'),
      },
    );

  const blocked = work.openItems > 0;
  return (
    <Sheet title="Your decision" className={styles.decision}>
      <div className={styles.decide}>
        {blocked && allowed.includes('approve') && (
          <Notice tone="warn">
            {work.openItems} revision checklist item{work.openItems > 1 ? 's are' : ' is'} still open. Confirm each fix below before approving.
          </Notice>
        )}
        <div className={styles.buttons}>
          {allowed.includes('approve') && (
            <Button variant="ok" icon={<CircleCheck size={18} aria-hidden="true" />} disabled={blocked || decide.isPending} onClick={() => run('approve')}>
              Approve &amp; sign off
            </Button>
          )}
          {allowed.includes('start_review') && (
            <Button icon={<PenLine size={18} aria-hidden="true" />} disabled={decide.isPending} onClick={() => run('start_review')}>
              Start review
            </Button>
          )}
          {allowed.includes('revise') && (
            <Button disabled={decide.isPending} onClick={() => setReturning(true)}>
              Return with comments
            </Button>
          )}
          {allowed.includes('reject') && (
            <Button
              variant="danger"
              disabled={decide.isPending}
              onClick={() => window.confirm(`Mark “${work.title}” as not approved? This is final.`) && run('reject')}
            >
              Reject
            </Button>
          )}
        </div>
        <p className={styles.hint}>Approval publishes the work to the feed and its authors’ portfolios, with your name as the approver.</p>
      </div>
      <ReturnForm open={returning} onClose={() => setReturning(false)} pending={decide.isPending} onSend={(comment, items) => run('revise', { comment, items }, () => setReturning(false))} />
    </Sheet>
  );
}

function ReturnForm({ open, onClose, onSend, pending }: { open: boolean; onClose: () => void; onSend: (comment: string, items: string[]) => void; pending: boolean }) {
  const [comment, setComment] = useState('');
  const [list, setList] = useState('');
  const items = list.split('\n').map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim()).filter(Boolean);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSend(comment.trim(), items);
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Return with comments"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="return-form" variant="primary" loading={pending} disabled={!comment.trim() && items.length === 0}>
            Send to the author
          </Button>
        </>
      }
    >
      <form id="return-form" className={styles.form} onSubmit={submit}>
        <TextAreaField label="Comments for the author" value={comment} onChange={(e) => setComment(e.target.value)} rows={4} maxLength={4000} />
        <TextAreaField
          label="Revision checklist (one fix per line)"
          value={list}
          onChange={(e) => setList(e.target.value)}
          rows={5}
          placeholder={'Add the latency distribution chart\nCite the 2024 PAGASA flood data'}
          hint="The author ticks each fix; you confirm it before you can approve."
        />
      </form>
    </Modal>
  );
}

// ---------- Review history ----------

/** Reviews in order, each with its checklist, plus the version history. Authors, adviser and admins only. */
export function ReviewHistory({ work }: { work: WorkDetail }) {
  const patch = usePatchItem();
  const toast = useToast();
  if (work.reviews.length === 0 && work.versions.length === 0) return null;

  const toggle = (itemId: number, change: { done?: boolean; confirmed?: boolean }) =>
    patch.mutate({ id: work.id, itemId, ...change }, { onError: (e) => toast(e.message, 'error') });

  return (
    <Sheet title="Review history" aside="Private to authors and adviser">
      <div className={styles.history}>
        {work.reviews.length === 0 && <p className={styles.quiet}>No review yet. Your adviser has been notified.</p>}
        <ol className={styles.reviews}>
          {work.reviews.map((r) => (
            <li key={r.id} className={clsx(styles.review, styles[r.decision])}>
              <div className={styles.reviewHead}>
                <Person user={r.reviewer} size="sm" sub={`${decisionLabel[r.decision]} · version ${r.version}`} />
                <time className={styles.when} dateTime={r.createdAt}>
                  {relTime(r.createdAt)}
                </time>
              </div>
              {r.comment && <p className={styles.comment}>{r.comment}</p>}
              {r.items.length > 0 && (
                <ul className={styles.checklist} aria-label="Revision checklist">
                  {r.items.map((i) => (
                    <li key={i.id} className={clsx(styles.item, i.confirmed && styles.confirmed)}>
                      <label className={styles.tick}>
                        <input
                          type="checkbox"
                          checked={i.done}
                          disabled={!work.can.tickItems || i.confirmed || patch.isPending}
                          onChange={(e) => toggle(i.id, { done: e.target.checked })}
                        />
                        <span>{i.text}</span>
                      </label>
                      {i.confirmed ? (
                        <Badge tone="ok" icon={<CheckCheck size={13} aria-hidden="true" />}>
                          Confirmed
                        </Badge>
                      ) : work.can.confirmItems ? (
                        <Button disabled={!i.done || patch.isPending} onClick={() => toggle(i.id, { confirmed: true })}>
                          Confirm fix
                        </Button>
                      ) : (
                        <Badge tone={i.done ? 'blue' : 'neutral'}>{i.done ? 'Done, awaiting adviser' : 'To do'}</Badge>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>

        {work.versions.length > 0 && (
          <div className={styles.versions}>
            <h3 className={styles.subhead}>Versions</h3>
            <ol className={styles.versionList}>
              {work.versions.map((v) => (
                <li key={v.version} className={styles.version}>
                  <span className={styles.vno}>v{v.version}</span>
                  <span className={styles.vbody}>
                    <span className={styles.vdate}>Submitted {fmtDate(v.submittedAt)}</span>
                    {v.note && <span className={styles.vnote}>{v.note}</span>}
                  </span>
                  {v.pdfName && (
                    <a href={`/api/works/${work.id}/versions/${v.version}/pdf`} target="_blank" rel="noreferrer" className={styles.vpdf}>
                      <FileText size={16} aria-hidden="true" />
                      PDF<span className="sr-only"> of version {v.version}</span>
                    </a>
                  )}
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </Sheet>
  );
}

// ---------- Review thread ----------

/** The private thread between authors and adviser while the work is in review. */
export function ReviewThread({ work }: { work: WorkDetail }) {
  const [text, setText] = useState('');
  const send = useReviewComment();
  const toast = useToast();
  if (!work.can.comment && work.thread.length === 0) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    send.mutate({ id: work.id, text }, { onSuccess: () => setText(''), onError: (e) => toast(e.message, 'error') });
  };

  return (
    <Sheet title="Review thread" aside={`${work.thread.length}`}>
      <div className={styles.thread}>
        {work.thread.length === 0 && <p className={styles.quiet}>No comments yet.</p>}
        {work.thread.map((c) => (
          <div key={c.id} className={styles.message}>
            <Person user={c.author} size="sm" sub={relTime(c.createdAt)} />
            <p className={styles.bubble}>{c.text}</p>
          </div>
        ))}
        {work.can.comment && (
          <form className={styles.reply} onSubmit={submit}>
            <TextAreaField label="Add a comment" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} required />
            <Button type="submit" icon={<Send size={16} aria-hidden="true" />} loading={send.isPending}>
              Comment
            </Button>
          </form>
        )}
      </div>
    </Sheet>
  );
}
