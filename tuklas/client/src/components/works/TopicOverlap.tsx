/**
 * TopicOverlap — warns authors on the submit form when their topic is close to approved works.
 */
import { Lightbulb } from 'lucide-react';
import { useSimilar } from '../../api/works';
import { useDebounced } from '../../lib/useDebounced';
import { typeLabel } from '../../lib/labels';
import { Notice } from '../ui/Notice';
import styles from './TopicOverlap.module.css';

/** Topic overlap check: while a title and keywords are typed, similar approved works from the school appear. */
export function TopicOverlap({ title, keywords, exclude }: { title: string; keywords: string; exclude?: number }) {
  const t = useDebounced(title, 450);
  const k = useDebounced(keywords, 450);
  const { data } = useSimilar(t, k, exclude);
  if (!data?.length || `${title}${keywords}`.trim().length < 4) return null;

  return (
    <Notice tone="gold" icon={<Lightbulb size={18} aria-hidden="true" />}>
      <p className={styles.lead}>
        <strong>Similar approved works at your school.</strong> Check them so your topic adds something new.
      </p>
      <ul className={styles.list}>
        {data.map((w) => (
          <li key={w.id}>
            <a href={`/works/${w.id}`} target="_blank" rel="noreferrer" className={styles.title}>
              {w.title}
            </a>
            <span className={styles.meta}>
              {typeLabel[w.type]} · {w.authors.join(', ')} ({w.year}) · shares <em>{w.shared.slice(0, 4).join(', ')}</em>
            </span>
          </li>
        ))}
      </ul>
    </Notice>
  );
}
