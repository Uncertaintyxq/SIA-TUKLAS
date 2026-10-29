/**
 * PortfolioPage — academic portfolios: your editable one ("/portfolio") and public ones ("/u/:username").
 * Shows works, published research, links, background, honors and CV.
 */
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Award,
  BadgeCheck,
  BookOpen,
  Eye,
  FileText,
  Globe,
  GraduationCap,
  Link2,
  Pencil,
  ScrollText,
  Trash2,
  Upload,
} from 'lucide-react';
import type { BackgroundView, HonorView, LinkType } from '@server/schemas/profile';
import { useMe } from '../api/auth';
import { useDeleteBackground, useDeleteHonor, usePortfolio, useRemoveCv, useUploadCv, type Portfolio } from '../api/portfolio';
import { BackgroundForm, HonorForm, LinksForm, ProfileForm } from '../components/portfolio/PortfolioForms';
import { PublicationEntry } from '../components/publications/PublicationEntry';
import { WorkEntry, useShare } from '../components/works/WorkEntry';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Notice } from '../components/ui/Notice';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { honorLabel, linkLabel, roleBadge } from '../lib/labels';
import styles from './PortfolioPage.module.css';

// ---------- Pages ----------

type Dialog =
  | { kind: 'profile' }
  | { kind: 'links' }
  | { kind: 'background'; row?: BackgroundView }
  | { kind: 'honor'; row?: HonorView }
  | null;

/** /portfolio: your own portfolio, in edit mode. */
export function MyPortfolioPage() {
  const { data: me } = useMe();
  return <PortfolioView username={me?.username} editMode />;
}

/** /u/:username: the read-only public portfolio anyone can open. */
export function PublicPortfolioPage() {
  return <PortfolioView username={useParams().username} editMode={false} />;
}

function PortfolioView({ username, editMode }: { username: string | undefined; editMode: boolean }) {
  const { data: p, isPending, error } = usePortfolio(username);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const open = (d: NonNullable<Dialog>) => {
    setDialogKey((k) => k + 1);
    setDialog(d);
  };

  if (isPending)
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton className={styles.skCover} />
        <Skeleton className={styles.skLine} />
      </div>
    );
  if (error || !p)
    return (
      <EmptyState title="There’s no portfolio here" action={<ButtonLink to="/feed">Back to the feed</ButtonLink>}>
        {error?.message ?? 'Check the address and try again.'}
      </EmptyState>
    );

  // The server decides ownership; editing is offered only on /portfolio, never on the public page.
  const edit = editMode && p.isOwner;
  return (
    <div className={styles.page}>
      {edit && (
        <Notice icon={<Eye size={18} aria-hidden="true" />}>
          You’re editing your portfolio. Everyone else sees the read-only page at{' '}
          <Link to={`/u/${p.user.username}`}>/u/{p.user.username}</Link>.
        </Notice>
      )}
      <Cover p={p} edit={edit} onEdit={() => open({ kind: 'profile' })} />

      <div className={styles.layout}>
        <div className={styles.main}>
          {(p.bioLong || edit) && (
            <Sheet title="About" actions={edit && <EditButton label="Edit about" onClick={() => open({ kind: 'profile' })} />}>
              {p.bioLong ? <div className={styles.bio}>{p.bioLong.split(/\n{2,}/).map((para, i) => <p key={i}>{para}</p>)}</div> : <p className={styles.quiet}>Add an extended bio: your research interests, projects and what you’re working toward.</p>}
            </Sheet>
          )}

          {(p.publications.length > 0 || (edit && p.user.role === 'educator')) && (
            <Sheet title="Published research" aside={String(p.publications.length)}>
              {p.publications.length === 0 ? (
                <p className={styles.quiet}>
                  Research you publish as Internal or Public appears here. Write it in <Link to="/research">My research</Link>.
                </p>
              ) : (
                <div className={styles.works}>
                  {p.publications.map((pub) => (
                    <PublicationEntry key={pub.id} item={pub} />
                  ))}
                </div>
              )}
            </Sheet>
          )}

          {(p.user.role !== 'educator' || p.works.length > 0) && (
          <Sheet title="Research & literary works" aside={String(p.works.length)}>
            {p.works.length === 0 ? (
              <p className={styles.quiet}>
                {edit ? (
                  <>
                    Your works appear here automatically once your adviser approves them. Track drafts and reviews in <Link to="/research">My research</Link>.
                  </>
                ) : (
                  'No published works yet.'
                )}
              </p>
            ) : (
              <div className={styles.works}>
                {p.works.map((w) => (
                  <WorkEntry key={w.id} work={w} compact />
                ))}
              </div>
            )}
          </Sheet>
          )}

          {p.user.role === 'educator' && p.mentored.length > 0 && (
            <Sheet title="Mentored works" aside="Approved as research adviser">
              <div className={styles.works}>
                {p.mentored.map((w) => (
                  <WorkEntry key={w.id} work={w} compact />
                ))}
              </div>
            </Sheet>
          )}
        </div>

        <aside className={styles.side}>
          <LinksSheet p={p} edit={edit} onEdit={() => open({ kind: 'links' })} />
          <BackgroundSheet p={p} edit={edit} onAdd={(row) => open({ kind: 'background', row })} />
          <HonorsSheet p={p} edit={edit} onAdd={(row) => open({ kind: 'honor', row })} />
          <CvSheet p={p} edit={edit} />
        </aside>
      </div>

      {edit && (
        <>
          <ProfileForm key={`p${dialogKey}`} open={dialog?.kind === 'profile'} onClose={() => setDialog(null)} portfolio={p} />
          <LinksForm key={`l${dialogKey}`} open={dialog?.kind === 'links'} onClose={() => setDialog(null)} links={p.links} />
          <BackgroundForm key={`b${dialogKey}`} open={dialog?.kind === 'background'} onClose={() => setDialog(null)} row={dialog?.kind === 'background' ? dialog.row : undefined} />
          <HonorForm key={`h${dialogKey}`} open={dialog?.kind === 'honor'} onClose={() => setDialog(null)} row={dialog?.kind === 'honor' ? dialog.row : undefined} isAdmin={p.user.role === 'admin'} />
        </>
      )}
    </div>
  );
}

// ---------- Cover ----------

function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Button variant="ghost" icon={<Pencil size={16} aria-hidden="true" />} onClick={onClick}>
      {label}
    </Button>
  );
}

function Cover({ p, edit, onEdit }: { p: Portfolio; edit: boolean; onEdit: () => void }) {
  const share = useShare();
  const { user } = p;
  const badgeTone = user.role === 'admin' ? 'neutral' : user.role === 'educator' ? (user.verified ? 'blue' : 'warn') : 'purple';
  return (
    <section className={styles.cover} aria-label="Profile">
      <div className={styles.cloth} aria-hidden="true" />
      <div className={styles.coverBody}>
        <Avatar name={user.name} role={user.role} photo={user.photoUrl} size="lg" />
        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>
              {user.name}
              {p.titles && <span className={styles.titles}>, {p.titles}</span>}
            </h1>
            <Badge tone={badgeTone} icon={user.role === 'educator' && user.verified ? <BadgeCheck size={14} aria-hidden="true" /> : undefined}>
              {roleBadge(user)}
            </Badge>
          </div>
          <p className={styles.position}>
            {user.program}
            {user.department && <> · {user.department}</>}
          </p>
          {user.headline && <p className={styles.headline}>{user.headline}</p>}
          <div className={styles.coverActions}>
            {edit && (
              <Button variant="primary" icon={<Pencil size={16} aria-hidden="true" />} onClick={onEdit}>
                Edit profile
              </Button>
            )}
            {edit && (
              <ButtonLink to={`/u/${user.username}`} icon={<Eye size={16} aria-hidden="true" />}>
                View public page
              </ButtonLink>
            )}
            {!edit && p.isOwner && (
              <ButtonLink to="/portfolio" icon={<Pencil size={16} aria-hidden="true" />}>
                Edit portfolio
              </ButtonLink>
            )}
            <Button icon={<Link2 size={16} aria-hidden="true" />} onClick={() => share(`/u/${user.username}`, 'Portfolio link')}>
              Share
            </Button>
          </div>
        </div>
      </div>
      <dl className={styles.stats}>
        <div>
          <dt>Published works</dt>
          <dd>{p.stats.published}</dd>
        </div>
        {user.role === 'educator' && (
          <>
            <div>
              <dt>Research published</dt>
              <dd>{p.stats.publications}</dd>
            </div>
            <div>
              <dt>Works advised</dt>
              <dd>{p.stats.mentored}</dd>
            </div>
          </>
        )}
        <div>
          <dt>Verified honors</dt>
          <dd>{p.stats.verifiedHonors}</dd>
        </div>
        <div>
          <dt>Degrees &amp; diplomas</dt>
          <dd>{p.stats.degrees}</dd>
        </div>
      </dl>
    </section>
  );
}

// ---------- Side sheets ----------

const linkIcon: Record<LinkType, typeof Globe> = {
  scholar: GraduationCap,
  orcid: BadgeCheck,
  researchgate: BookOpen,
  linkedin: Link2,
  faculty: ScrollText,
  other: Globe,
};

function LinksSheet({ p, edit, onEdit }: { p: Portfolio; edit: boolean; onEdit: () => void }) {
  if (!edit && p.links.length === 0) return null;
  return (
    <Sheet title="Academic links" flush actions={edit && <EditButton label="Edit" onClick={onEdit} />}>
      {p.links.length === 0 ? (
        <SheetEmpty>Add Google Scholar, ORCID, ResearchGate, LinkedIn or your faculty page.</SheetEmpty>
      ) : (
        <ul className={styles.rows}>
          {p.links.map((l) => {
            const Icon = linkIcon[l.type];
            return (
              <li key={l.id}>
                <a href={l.url} target="_blank" rel="noreferrer noopener" className={styles.linkRow}>
                  <Icon size={18} aria-hidden="true" className={styles.rowIcon} />
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{l.type === 'other' && l.label ? l.label : linkLabel[l.type]}</span>
                    <span className={styles.rowSub}>{l.url.replace(/^https?:\/\/(www\.)?/, '')}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </Sheet>
  );
}

function BackgroundSheet({ p, edit, onAdd }: { p: Portfolio; edit: boolean; onAdd: (row?: BackgroundView) => void }) {
  const del = useDeleteBackground();
  const toast = useToast();
  return (
    <Sheet title="Academic background" flush actions={edit && <EditButton label="Add" onClick={() => onAdd()} />}>
      {p.background.length === 0 ? (
        <SheetEmpty>No diplomas or degrees listed.</SheetEmpty>
      ) : (
        <ul className={styles.rows}>
          {p.background.map((b) => (
            <li key={b.id} className={styles.row}>
              <GraduationCap size={18} aria-hidden="true" className={styles.rowIcon} />
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{b.degree}</span>
                <span className={styles.rowSub}>
                  {b.school} · <span className={styles.mono}>{b.year}</span>
                </span>
              </span>
              {edit && (
                <RowTools
                  label={b.degree}
                  onEdit={() => onAdd(b)}
                  onDelete={() => del.mutate(b.id, { onSuccess: () => toast('Removed.'), onError: (e) => toast(e.message, 'error') })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function HonorsSheet({ p, edit, onAdd }: { p: Portfolio; edit: boolean; onAdd: (row?: HonorView) => void }) {
  const del = useDeleteHonor();
  const toast = useToast();
  return (
    <Sheet title="Honors & awards" flush actions={edit && <EditButton label="Add" onClick={() => onAdd()} />}>
      {p.honors.length === 0 ? (
        <SheetEmpty>No honors, grants or certifications yet.</SheetEmpty>
      ) : (
        <ul className={styles.rows}>
          {p.honors.map((h) => (
            <li key={h.id} className={styles.row}>
              <Award size={18} aria-hidden="true" className={styles.honorIcon} />
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{h.title}</span>
                <span className={styles.rowSub}>
                  {h.issuer} · <span className={styles.mono}>{h.year}</span>
                </span>
                <span className={styles.honorBadges}>
                  <Badge tone="neutral">{honorLabel[h.kind]}</Badge>
                  {h.verified ? <Badge tone="ok">Verified</Badge> : <Badge tone="gold">Pending verification</Badge>}
                </span>
              </span>
              {edit && (
                <RowTools
                  label={h.title}
                  onEdit={() => onAdd(h)}
                  onDelete={() => del.mutate(h.id, { onSuccess: () => toast('Removed.'), onError: (e) => toast(e.message, 'error') })}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}

function RowTools({ label, onEdit, onDelete }: { label: string; onEdit: () => void; onDelete: () => void }) {
  return (
    <span className={styles.rowTools}>
      <button type="button" className={styles.tool} onClick={onEdit}>
        <Pencil size={16} aria-hidden="true" />
        <span className="sr-only">Edit {label}</span>
      </button>
      <button type="button" className={styles.tool} onClick={() => window.confirm(`Remove “${label}”?`) && onDelete()}>
        <Trash2 size={16} aria-hidden="true" />
        <span className="sr-only">Remove {label}</span>
      </button>
    </span>
  );
}

function CvSheet({ p, edit }: { p: Portfolio; edit: boolean }) {
  const upload = useUploadCv();
  const remove = useRemoveCv();
  const toast = useToast();
  if (!edit && !p.cv) return null;
  return (
    <Sheet title="Curriculum vitae">
      <div className={styles.cv}>
        {p.cv ? (
          <div className={styles.cvFile}>
            <FileText size={22} aria-hidden="true" className={styles.rowIcon} />
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>{p.cv.name}</span>
              <span className={styles.cvLinks}>
                <a href={p.cv.url} target="_blank" rel="noreferrer">
                  View
                </a>
                <a href={`${p.cv.url}?download=1`}>Download</a>
              </span>
            </span>
          </div>
        ) : (
          <p className={styles.quiet}>Upload your CV as a PDF. Visitors can view and download it.</p>
        )}
        {edit && (
          <div className={styles.cvTools}>
            <label className={styles.upload}>
              <Upload size={16} aria-hidden="true" />
              {upload.isPending ? 'Uploading…' : p.cv ? 'Replace PDF' : 'Upload PDF'}
              <input
                type="file"
                accept="application/pdf"
                className="sr-only"
                disabled={upload.isPending}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (file) upload.mutate(file, { onSuccess: () => toast('CV uploaded.', 'success'), onError: (err) => toast(err.message, 'error') });
                }}
              />
            </label>
            {p.cv && (
              <Button variant="danger" onClick={() => window.confirm('Remove your CV?') && remove.mutate(undefined, { onSuccess: () => toast('CV removed.') })}>
                Remove
              </Button>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

