/**
 * MyResearchPage — /research. Students track each submission on its journey to approval;
 * educators draft and publish their own research. Both see their research groups beside it.
 */
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { FilePlus2, ListChecks, PenLine, Users } from 'lucide-react';
import { useMe } from '../api/auth';
import { useGroups } from '../api/groups';
import { useMyPublications } from '../api/publications';
import { useMyWorks, type MyWork } from '../api/works';
import { PageHeader } from '../components/layout/PageHeader';
import { PublicationEntry } from '../components/publications/PublicationEntry';
import { EntryForm } from '../components/works/EntryForm';
import { Journey } from '../components/works/Journey';
import { StatusBadge, TypeTag } from '../components/works/WorkBadges';
import { Badge } from '../components/ui/Badge';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { entryNo, fmtDate, plural, relTime } from '../lib/format';
import styles from './MyResearchPage.module.css';

export function MyResearchPage() {
  const { data: me } = useMe();
  return me?.role === 'educator' ? <EducatorResearch /> : <StudentResearch />;
}

// ---------- Students: submissions on their way to approval ----------

function StudentResearch() {
  const { data: me } = useMe();
  const { data: works, isPending } = useMyWorks();
  const [params, setParams] = useSearchParams();
  const [formKey, setFormKey] = useState(0);
  const [editing, setEditing] = useState<MyWork | null>(null);
  // "New entry" opens the form through ?new=1, so the browser's back button closes it.
  const creating = params.get('new') === '1';
  const formOpen = creating || editing !== null;
  const canSubmit = me?.role === 'student';

  // A fresh form every time "New entry" opens.
  useEffect(() => {
    if (creating) setFormKey((k) => k + 1);
  }, [creating]);

  const openNew = () => setParams({ new: '1' }, { replace: true });
  const close = () => {
    setEditing(null);
    if (creating) setParams({}, { replace: true });
  };

  return (
    <>
      <PageHeader
        title="My research"
        description="Track each submission on its journey from defense to discovery. Works go public once your adviser or the panel approves them."
        actions={
          canSubmit && (
            <Button variant="primary" icon={<PenLine size={18} aria-hidden="true" />} onClick={openNew}>
              New entry
            </Button>
          )
        }
      />
      <div className={styles.layout}>
        <div className={styles.list}>
          {isPending ? (
            <>
              <Skeleton className={styles.skeleton} />
              <Skeleton className={styles.skeleton} />
            </>
          ) : !works?.length ? (
            <EmptyState
              title="No entries yet"
              action={
                canSubmit && (
                  <Button variant="primary" onClick={openNew}>
                    Start your first entry
                  </Button>
                )
              }
            >
              Submit your first research paper, literary work or innovation to start the approval flow.
            </EmptyState>
          ) : (
            works.map((w) => (
              <WorkRow
                key={w.id}
                work={w}
                onEdit={() => {
                  setFormKey((k) => k + 1);
                  setEditing(w);
                }}
              />
            ))
          )}
        </div>
        <aside className={styles.side}>
          <Groups />
        </aside>
      </div>
      <EntryForm key={`${formKey}-${editing?.id ?? 'new'}`} open={formOpen} onClose={close} work={editing ?? undefined} />
    </>
  );
}

// ---------- Educators: their own research, published directly ----------

function EducatorResearch() {
  const { data: me } = useMe();
  const { data: publications, isPending } = useMyPublications(true);
  const { data: works } = useMyWorks();
  const canWrite = Boolean(me?.verified);

  return (
    <>
      <PageHeader
        title="My research"
        description="Draft your research, then publish it to the institution or to everyone. Students read and cite it in the research library."
        actions={
          canWrite && (
            <ButtonLink to="/publications/new" variant="primary" icon={<FilePlus2 size={18} aria-hidden="true" />}>
              New research
            </ButtonLink>
          )
        }
      />
      <div className={styles.layout}>
        <div className={styles.list}>
          {isPending ? (
            <Skeleton className={styles.skeleton} />
          ) : !publications?.length ? (
            <EmptyState title="No research yet" action={canWrite && <ButtonLink to="/publications/new" variant="primary">Write your first</ButtonLink>}>
              {canWrite ? 'Publish your papers, reports and teaching notes so students can read and cite them.' : 'An admin needs to verify your educator account before you can write research here.'}
            </EmptyState>
          ) : (
            publications.map((p) => (
              <PublicationEntry
                key={p.id}
                item={p}
                showVisibility
                actions={
                  <>
                    <ButtonLink to={`/publications/${p.id}`}>Open</ButtonLink>
                    {p.authors[0]?.id === me?.id && <ButtonLink to={`/publications/${p.id}/edit`}>Edit</ButtonLink>}
                  </>
                }
              />
            ))
          )}
          {works && works.length > 0 && (
            <Sheet title="Student works you co-authored" aside={String(works.length)} flush>
              <ul className={styles.groups}>
                {works.map((w) => (
                  <li key={w.id}>
                    <Link to={`/works/${w.id}`} className={styles.group}>
                      <span className={styles.groupText}>
                        <span className={styles.groupName}>{w.title}</span>
                        <span className={styles.groupMeta}>{w.authors.map((a) => a.name).join(', ')}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Sheet>
          )}
        </div>
        <aside className={styles.side}>
          <Groups />
        </aside>
      </div>
    </>
  );
}

function WorkRow({ work: w, onEdit }: { work: MyWork; onEdit: () => void }) {
  const editable = w.isOwner && (w.status === 'draft' || w.status === 'revision');
  return (
    <article className={styles.entry}>
      <div className={styles.head}>
        <span className={styles.no}>{entryNo(w.id)}</span>
        <TypeTag type={w.type} />
        <StatusBadge status={w.status} removed={w.removed} />
        {!w.isOwner && <Badge tone="neutral">Co-author</Badge>}
        <span className={styles.updated}>Updated {relTime(w.updatedAt)}</span>
      </div>
      <h2 className={styles.title}>
        <Link to={`/works/${w.id}`} className={styles.titleLink}>
          {w.title}
        </Link>
      </h2>
      <p className={styles.meta}>
        Adviser: {w.adviser.name}
        {w.submittedAt && <> · Submitted {fmtDate(w.submittedAt)}</>}
        {w.versionCount > 0 && <> · {plural(w.versionCount, 'version')}</>}
      </p>
      <Journey status={w.status} />
      {w.status === 'revision' && w.latestReview?.comment && (
        <blockquote className={styles.feedback}>
          <span className={styles.feedbackLabel}>{w.latestReview.reviewerName}:</span> {w.latestReview.comment}
        </blockquote>
      )}
      <div className={styles.actions}>
        <ButtonLink to={`/works/${w.id}`}>Open</ButtonLink>
        {editable && (
          <Button variant={w.status === 'revision' ? 'primary' : 'secondary'} onClick={onEdit}>
            {w.status === 'revision' ? 'Revise & resubmit' : 'Edit draft'}
          </Button>
        )}
        {w.openItems > 0 && (
          <Badge tone="warn" icon={<ListChecks size={14} aria-hidden="true" />}>
            {plural(w.openItems, 'checklist item')} open
          </Badge>
        )}
      </div>
    </article>
  );
}

function Groups() {
  const { data: groups } = useGroups();
  return (
    <Sheet title="Research groups" flush actions={<Link to="/groups" className={styles.sideLink}>All groups</Link>}>
      {!groups?.length ? (
        <SheetEmpty>Research groups you lead, mentor or belong to appear here, with their chat, files and deadlines.</SheetEmpty>
      ) : (
        <ul className={styles.groups}>
          {groups.map((g) => (
            <li key={g.id}>
              <Link to={`/groups/${g.id}`} className={styles.group}>
                <Users size={18} aria-hidden="true" className={styles.groupIcon} />
                <span className={styles.groupText}>
                  <span className={styles.groupName}>{g.name}</span>
                  <span className={styles.groupMeta}>
                    {g.nextDeadline ? `Next: ${g.nextDeadline.title} · ${fmtDate(g.nextDeadline.dueAt)}` : `${plural(g.memberCount, 'member')} · ${g.adviser.name}`}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
