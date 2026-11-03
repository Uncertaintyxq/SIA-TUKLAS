/**
 * Reach — how often research was read. ReachPanel (My research) totals the views and downloads of
 * your public works and research and lists the most-read ones; reachLabel is the one-line version
 * on a work or publication page. Each person counts once a day, and authors' own visits don't count
 * (App\Support\Reach on the server).
 */
import { Link } from 'react-router-dom';
import { Download, Eye } from 'lucide-react';
import { Sheet } from '../ui/Sheet';
import styles from './Reach.module.css';

export interface ReachItem {
  key: string;
  title: string;
  to: string;
  views: number;
  downloads: number;
}

const count = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`;

/** "1,204 views · 87 downloads" */
export const reachLabel = (views: number, downloads: number) => `${count(views, 'view')} · ${count(downloads, 'download')}`;

export function ReachPanel({ items }: { items: ReachItem[] }) {
  const views = items.reduce((n, i) => n + i.views, 0);
  const downloads = items.reduce((n, i) => n + i.downloads, 0);
  const top = items
    .filter((i) => i.views + i.downloads > 0)
    .sort((a, b) => b.views - a.views || b.downloads - a.downloads)
    .slice(0, 5);

  return (
    <Sheet title="Reach" flush>
      <dl className={styles.totals}>
        <div>
          <dt>
            <Eye size={15} aria-hidden="true" /> Views
          </dt>
          <dd>{views.toLocaleString('en-US')}</dd>
        </div>
        <div>
          <dt>
            <Download size={15} aria-hidden="true" /> Downloads
          </dt>
          <dd>{downloads.toLocaleString('en-US')}</dd>
        </div>
      </dl>
      {top.length === 0 ? (
        <p className={styles.empty}>Counts start once your work is public. Each reader counts once a day; your own visits don’t count.</p>
      ) : (
        <ol className={styles.list} aria-label="Most read">
          {top.map((i) => (
            <li key={i.key}>
              <Link to={i.to} className={styles.item}>
                <span className={styles.title}>{i.title}</span>
                <span className={styles.meta}>{reachLabel(i.views, i.downloads)}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Sheet>
  );
}
