/**
 * PublicationEntry — an educator's research as a library entry: visibility, title, authors, abstract,
 * keywords and the publication date. Used by the library, portfolios and My research.
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { PublicationCard, PublicationVisibility } from '../../api/publications';
import { isoDate } from '../../lib/format';
import { Byline } from '../people/Person';
import { Badge, type BadgeTone } from '../ui/Badge';
import styles from './PublicationEntry.module.css';

const visibility: Record<PublicationVisibility, { label: string; tone: BadgeTone }> = {
  draft: { label: 'Draft', tone: 'neutral' },
  internal: { label: 'Institutional only', tone: 'blue' },
  public: { label: 'Public', tone: 'ok' },
};

export function VisibilityBadge({ value }: { value: PublicationVisibility }) {
  return <Badge tone={visibility[value].tone}>{visibility[value].label}</Badge>;
}

export function PublicationEntry({ item: p, showVisibility = false, actions }: { item: PublicationCard; showVisibility?: boolean; actions?: ReactNode }) {
  return (
    <article className={styles.entry}>
      <div className={styles.head}>
        <Badge tone="purple">Educator research</Badge>
        {(showVisibility || p.visibility !== 'public') && <VisibilityBadge value={p.visibility} />}
        {p.hasPdf && (
          <span className={styles.pdf}>
            <FileText size={14} aria-hidden="true" />
            PDF
          </span>
        )}
        {p.publishedAt && (
          <time className={styles.date} dateTime={p.publishedAt}>
            {isoDate(p.publishedAt)}
          </time>
        )}
      </div>
      <h3 className={styles.title}>
        <Link to={`/publications/${p.id}`} className={styles.titleLink}>
          {p.title}
        </Link>
      </h3>
      <p className={styles.by}>
        <Byline users={p.authors} />
        {p.department && <span className={styles.dept}> · {p.department}</span>}
      </p>
      <p className={styles.abstract}>{p.abstract}</p>
      {p.keywords.length > 0 && (
        <ul className={styles.tags} aria-label="Keywords">
          {p.keywords.map((k) => (
            <li key={k}>
              <Link to={`/library?q=${encodeURIComponent(k)}`} className={styles.tag}>
                #{k}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {actions && <div className={styles.actions}>{actions}</div>}
    </article>
  );
}
