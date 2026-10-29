/**
 * LibraryPage — /library. The student browsing view of educator research: search by title,
 * keyword or author, then open a publication to read, cite and reference it.
 */
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useLibrary } from '../api/publications';
import { PageHeader } from '../components/layout/PageHeader';
import { PublicationEntry } from '../components/publications/PublicationEntry';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { useDebounced } from '../lib/useDebounced';
import { plural } from '../lib/format';
import styles from './LibraryPage.module.css';

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const term = useDebounced(q, 250);
  const { data, isPending, isFetching } = useLibrary(term);

  return (
    <>
      <PageHeader title="Research library" description="Research published by educators on Tuklas. Read it here, cite it in APA or MLA, and reference it in your own work." />
      <div className={styles.column}>
        <div className={styles.search} role="search">
          <Search size={18} aria-hidden="true" className={styles.searchIcon} />
          <label className="sr-only" htmlFor="library-search">
            Search educator research
          </label>
          <input
            id="library-search"
            type="search"
            className={styles.searchInput}
            placeholder="Search titles, keywords, authors"
            value={q}
            onChange={(e) => setParams(e.target.value ? { q: e.target.value } : {}, { replace: true })}
          />
        </div>
        {isPending ? (
          <>
            <Skeleton className={styles.skeleton} />
            <Skeleton className={styles.skeleton} />
          </>
        ) : !data?.length ? (
          <EmptyState title={term ? 'Nothing matches that search' : 'No published research yet'}>
            {term ? 'Try another keyword or an author’s name.' : 'When educators publish their research, it appears here.'}
          </EmptyState>
        ) : (
          <>
            <p className={styles.count} aria-live="polite" aria-busy={isFetching}>
              {plural(data.length, 'publication')}
              {term && ` matching “${term}”`}
            </p>
            {data.map((p) => (
              <PublicationEntry key={p.id} item={p} />
            ))}
          </>
        )}
      </div>
    </>
  );
}
