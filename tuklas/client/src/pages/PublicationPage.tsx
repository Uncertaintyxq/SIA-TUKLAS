/**
 * PublicationPage — /publications/:id. Reading view for an educator's research: abstract, methodology,
 * full text and PDF, with APA/MLA citation and a share link. Public research opens without logging in;
 * Internal research needs a Tuklas account; drafts are visible to their authors only.
 */
import { useNavigate, useParams } from 'react-router-dom';
import { Download, ExternalLink, Link2, PenLine, Trash2 } from 'lucide-react';
import { useDeletePublication, usePublication } from '../api/publications';
import { Person } from '../components/people/Person';
import { VisibilityBadge } from '../components/publications/PublicationEntry';
import { CitationBox } from '../components/works/CiteAndShare';
import { useShare } from '../components/works/WorkEntry';
import { Button, ButtonLink } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Notice } from '../components/ui/Notice';
import { Sheet } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useToast } from '../components/ui/Toast';
import { publicationSource } from '../lib/citation';
import { fmtDate } from '../lib/format';
import styles from './PublicationPage.module.css';

export function PublicationPage() {
  const id = Number(useParams().id);
  const { data: p, isPending, error } = usePublication(id);
  const del = useDeletePublication();
  const share = useShare();
  const toast = useToast();
  const navigate = useNavigate();

  if (isPending)
    return (
      <div className={styles.loading} aria-busy="true">
        <Skeleton className={styles.skTitle} />
        <Skeleton className={styles.skBlock} />
      </div>
    );
  if (error || !p)
    return (
      <EmptyState title="This research isn’t available" action={<ButtonLink to="/library">Research library</ButtonLink>}>
        It may be a draft, shared with the institution only (log in to read it), or the link is wrong.
      </EmptyState>
    );

  const published = p.visibility !== 'draft';
  return (
    <article className={styles.page}>
      <header className={styles.head}>
        <div className={styles.meta}>
          <VisibilityBadge value={p.visibility} />
          {p.department && <span className={styles.dept}>{p.department}</span>}
          {p.publishedAt && <span className={styles.dept}>Published {fmtDate(p.publishedAt)}</span>}
        </div>
        <h1 className={styles.title}>{p.title}</h1>
        <ul className={styles.authors} aria-label="Authors">
          {p.authors.map((a) => (
            <li key={a.id}>
              <Person user={a} />
            </li>
          ))}
        </ul>
      </header>

      <div className={styles.layout}>
        <div className={styles.main}>
          {!published && <Notice>This is a draft. Only its authors can see it until it’s published as Internal or Public.</Notice>}
          {(p.can.edit || p.can.delete) && (
            <div className={styles.tools}>
              {p.can.edit && (
                <ButtonLink to={`/publications/${p.id}/edit`} variant="primary" icon={<PenLine size={16} aria-hidden="true" />}>
                  Edit research
                </ButtonLink>
              )}
              {p.can.delete && (
                <Button
                  variant="danger"
                  icon={<Trash2 size={16} aria-hidden="true" />}
                  loading={del.isPending}
                  onClick={() =>
                    window.confirm(`Delete “${p.title}”? This can’t be undone.`) &&
                    del.mutate(p.id, {
                      onSuccess: () => {
                        toast('Research deleted.');
                        navigate(p.can.edit ? '/research' : '/library', { replace: true });
                      },
                      onError: (e) => toast(e.message, 'error'),
                    })
                  }
                >
                  Delete
                </Button>
              )}
            </div>
          )}

          <Sheet title="Abstract">
            <p className={styles.prose}>{p.abstract}</p>
            {p.keywords.length > 0 && (
              <ul className={styles.tags} aria-label="Keywords">
                {p.keywords.map((k) => (
                  <li key={k} className={styles.tag}>
                    #{k}
                  </li>
                ))}
              </ul>
            )}
          </Sheet>

          {p.methodology && (
            <Sheet title="Methodology">
              <p className={styles.prose}>{p.methodology}</p>
            </Sheet>
          )}

          {p.fullText && (
            <Sheet title="Full text">
              <div className={styles.fullText}>
                {p.fullText.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </Sheet>
          )}

          {p.pdfName && (
            <Sheet
              title="PDF"
              aside={p.pdfName}
              flush
              actions={
                <>
                  <a href={`/api/publications/${p.id}/pdf`} target="_blank" rel="noreferrer" className={styles.fileLink}>
                    <ExternalLink size={16} aria-hidden="true" />
                    Open
                  </a>
                  <a href={`/api/publications/${p.id}/pdf?download=1`} className={styles.fileLink}>
                    <Download size={16} aria-hidden="true" />
                    Download
                  </a>
                </>
              }
            >
              <iframe src={`/api/publications/${p.id}/pdf`} title={`PDF of ${p.title}`} className={styles.pdf} />
            </Sheet>
          )}
        </div>

        <aside className={styles.side}>
          {published && <CitationBox source={publicationSource(p)} title="Cite this research" />}
          {published && (
            <Sheet title="Share">
              <div className={styles.share}>
                <p className={styles.shareText}>
                  {p.visibility === 'public' ? 'Anyone with the link can read this research.' : 'Only people with a Tuklas account can open this link.'}
                </p>
                <Button icon={<Link2 size={16} aria-hidden="true" />} onClick={() => share(`/publications/${p.id}`)} block>
                  Copy link
                </Button>
              </div>
            </Sheet>
          )}
        </aside>
      </div>
    </article>
  );
}
