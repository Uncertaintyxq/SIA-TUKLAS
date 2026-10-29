/**
 * WorkPage — the "/works/:id" page that shows one work with its review, citation and discussion.
 * Authors get editing and submit tools; readers get save, cite and share tools.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bookmark, BookmarkCheck, Download, ExternalLink, EyeOff, Link2, PenLine, Send, Trash2 } from 'lucide-react';
import { useMe } from '../api/auth';
import { useDeleteDiscussion, useDeleteWork, useDiscuss, useSave, useSubmitWork, useWork, type WorkDetail } from '../api/works';
import { Tuko } from '../components/brand/Tuko';
import { Person } from '../components/people/Person';
import { CitationBox, QrBox, Reactions } from '../components/works/CiteAndShare';
import { DefenseTracker } from '../components/works/DefenseTracker';
import { EntryForm } from '../components/works/EntryForm';
import { Journey } from '../components/works/Journey';
import { DecisionBox, ReviewHistory, ReviewThread } from '../components/works/ReviewPanel';
import { StatusBadge, TypeTag } from '../components/works/WorkBadges';
import { useShare } from '../components/works/WorkEntry';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { TextAreaField } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { workSource } from '../lib/citation';
import { entryNo, fmtDate, relTime } from '../lib/format';
import styles from './WorkPage.module.css';

export function WorkPage() {
  const id = Number(useParams().id);
  const { data: work, isPending, error } = useWork(id);
  // Tuko cheers on the approval sheet right after the reviewer approves.
  const [approvedNow, setApprovedNow] = useState(false);

  // Deep links like /works/1#discussion scroll once the content is there.
  useEffect(() => {
    if (work && window.location.hash) document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: 'start' });
  }, [work]);

  if (isPending)
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton className={styles.skTitle} />
        <Skeleton className={styles.skBlock} />
      </div>
    );
  if (error || !work)
    return (
      <EmptyState title="This work isn’t public yet" action={<ButtonLink to="/feed">Back to the feed</ButtonLink>}>
        It may still be in review, or the link is wrong. Works appear here once an adviser or the academic panel approves them.
      </EmptyState>
    );

  const isPublic = work.status === 'approved' && !work.removed;
  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <div className={styles.meta}>
          <span className={styles.no}>{entryNo(work.id)}</span>
          <TypeTag type={work.type} />
          {!isPublic && <StatusBadge status={work.status} removed={work.removed} />}
          {work.department && <span className={styles.dept}>{work.department}</span>}
        </div>
        <h1 className={styles.title}>{work.title}</h1>
        <ul className={styles.authors} aria-label="Authors">
          {work.authors.map((a) => (
            <li key={a.id}>
              <Person user={a} />
            </li>
          ))}
        </ul>
        <p className={styles.adviser}>
          Research adviser: <Link to={`/u/${work.adviser.username}`}>{work.adviser.name}</Link>
          {work.submittedAt && <> · Submitted {fmtDate(work.submittedAt)}</>}
        </p>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          {!isPublic && <PrivateBanner work={work} />}
          <AuthorTools work={work} />
          <DecisionBox work={work} onApproved={() => setApprovedNow(true)} />

          <Sheet title="Abstract">
            <p className={styles.abstract}>{work.abstract}</p>
            {work.tags.length > 0 && (
              <ul className={styles.tags} aria-label="Keywords">
                {work.tags.map((t) => (
                  <li key={t}>
                    <Link to={`/feed?q=${encodeURIComponent(t)}`} className={styles.tag}>
                      #{t}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Sheet>

          {work.pdfName && (
            <Sheet
              title="Full text"
              aside={work.pdfName}
              flush
              actions={
                <>
                  <a href={`/api/works/${work.id}/pdf`} target="_blank" rel="noreferrer" className={styles.fileLink}>
                    <ExternalLink size={16} aria-hidden="true" />
                    Open
                  </a>
                  <a href={`/api/works/${work.id}/pdf?download=1`} className={styles.fileLink}>
                    <Download size={16} aria-hidden="true" />
                    Download
                  </a>
                </>
              }
            >
              <iframe src={`/api/works/${work.id}/pdf`} title={`PDF of ${work.title}`} className={styles.pdf} />
            </Sheet>
          )}

          <DefenseTracker workId={work.id} stages={work.stages} editable={work.can.manageStages} />
          <ReviewHistory work={work} />
          <ReviewThread work={work} />
          {isPublic && <Discussion work={work} />}
        </div>

        <aside className={styles.side}>
          {work.approval && (
            <Sheet title="Approval">
              <div className={styles.approval}>
                {approvedNow && <Tuko pose="cheer" size={64} />}
                <p className={styles.approvalText}>
                  Approved by <strong>{work.approval.approverName}</strong>
                  {work.approval.approverRole === 'admin' && ' for the Academic Panel'} on {fmtDate(work.approval.approvedAt)}.
                </p>
              </div>
            </Sheet>
          )}
          {isPublic && <ReadingTools work={work} />}
          {isPublic && <CitationBox source={workSource(work)} />}
          {isPublic && <QrBox work={work} />}
          {!isPublic && (
            <Sheet title="Journey">
              <Journey status={work.status} />
            </Sheet>
          )}
        </aside>
      </div>
    </article>
  );
}

// ---------- Page sections ----------

function PrivateBanner({ work }: { work: WorkDetail }) {
  if (work.removed)
    return (
      <Notice tone="bad" icon={<EyeOff size={18} aria-hidden="true" />}>
        An admin removed this work from the feed and portfolios. Only its authors, adviser and admins can see it.
      </Notice>
    );
  return (
    <Notice icon={<EyeOff size={18} aria-hidden="true" />}>
      <strong>Private until approved.</strong> Only the authors, the research adviser and admins can see this work.
    </Notice>
  );
}

/** Edit, submit or delete: the main author's controls while the work is a draft or sent back. */
function AuthorTools({ work }: { work: WorkDetail }) {
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const submit = useSubmitWork();
  const del = useDeleteWork();
  const toast = useToast();
  const navigate = useNavigate();
  if (!work.can.edit && !work.can.delete) return null;
  const revising = work.status === 'revision';

  return (
    <div className={styles.tools}>
      <Button
        variant={revising ? 'primary' : 'secondary'}
        icon={<PenLine size={17} aria-hidden="true" />}
        onClick={() => {
          setFormKey((k) => k + 1);
          setEditing(true);
        }}
      >
        {revising ? 'Revise & resubmit' : 'Edit entry'}
      </Button>
      {work.status === 'draft' && (
        <Button
          variant="primary"
          icon={<Send size={17} aria-hidden="true" />}
          loading={submit.isPending}
          onClick={() =>
            submit.mutate({ id: work.id }, { onSuccess: () => toast('Submitted. Your adviser will review it.', 'success'), onError: (e) => toast(e.message, 'error') })
          }
        >
          Submit for review
        </Button>
      )}
      {work.can.delete && (
        <Button
          variant="danger"
          icon={<Trash2 size={17} aria-hidden="true" />}
          onClick={() =>
            window.confirm('Delete this draft? This can’t be undone.') &&
            del.mutate(work.id, {
              onSuccess: () => {
                toast('Draft deleted.');
                navigate('/research', { replace: true });
              },
              onError: (e) => toast(e.message, 'error'),
            })
          }
        >
          Delete draft
        </Button>
      )}
      <EntryForm key={formKey} open={editing} onClose={() => setEditing(false)} work={{ ...work, hasPdf: Boolean(work.pdfName) }} />
    </div>
  );
}

function ReadingTools({ work }: { work: WorkDetail }) {
  const { data: me } = useMe();
  const save = useSave();
  const share = useShare();
  const toast = useToast();
  return (
    <Sheet title="Readers">
      <div className={styles.reading}>
        <Reactions work={work} canReact={Boolean(me)} />
        <div className={styles.readingButtons}>
          {me && (
            <Button
              icon={work.saved ? <BookmarkCheck size={17} aria-hidden="true" /> : <Bookmark size={17} aria-hidden="true" />}
              aria-pressed={work.saved}
              loading={save.isPending}
              onClick={() =>
                save.mutate(
                  { id: work.id, saved: !work.saved },
                  { onSuccess: () => toast(work.saved ? 'Removed from your library.' : 'Saved to your library.', 'success'), onError: (e) => toast(e.message, 'error') },
                )
              }
            >
              {work.saved ? 'Saved to library' : 'Save to library'}
            </Button>
          )}
          <Button icon={<Link2 size={17} aria-hidden="true" />} onClick={() => share(`/works/${work.id}`)}>
            Share link
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Public discussion on a published work. */
function Discussion({ work }: { work: WorkDetail }) {
  const [text, setText] = useState('');
  const discuss = useDiscuss();
  const remove = useDeleteDiscussion();
  const toast = useToast();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    discuss.mutate({ id: work.id, text }, { onSuccess: () => setText(''), onError: (e) => toast(e.message, 'error') });
  };

  return (
    <Sheet title="Discussion" aside={String(work.discussion.length)} id="discussion">
      <div className={styles.discussion}>
        {work.discussion.length === 0 && <SheetEmpty>No comments yet. Start an academic conversation about this work.</SheetEmpty>}
        {work.discussion.map((c) => (
          <div key={c.id} className={styles.comment}>
            <div className={styles.commentHead}>
              <Person user={c.author} size="sm" sub={relTime(c.createdAt)} />
              {c.canDelete && (
                <button
                  type="button"
                  className={styles.deleteComment}
                  onClick={() => window.confirm('Delete this comment?') && remove.mutate({ id: work.id, commentId: c.id }, { onError: (e) => toast(e.message, 'error') })}
                >
                  <Trash2 size={15} aria-hidden="true" />
                  <span className="sr-only">Delete comment</span>
                </button>
              )}
            </div>
            <p className={styles.commentText}>{c.text}</p>
          </div>
        ))}
        {work.can.discuss ? (
          <form className={styles.reply} onSubmit={submit}>
            <TextAreaField label="Add to the discussion" value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={4000} required />
            <Button type="submit" icon={<Send size={16} aria-hidden="true" />} loading={discuss.isPending}>
              Comment
            </Button>
          </form>
        ) : (
          <p className={styles.loginHint}>
            <Link to="/login">Log in</Link> to react and join the discussion.
          </p>
        )}
      </div>
    </Sheet>
  );
}
