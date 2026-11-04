/**
 * LibraryPage — /library. The student browsing view of educator research: search by title,
 * keyword or author, narrow by year, school, department and keyword, or browse by department (and follow
 * one), then open a publication to read, cite and reference it.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { Building2, Search, X } from 'lucide-react';
import { useMe } from '../api/auth';
import { departmentLabel, schoolLabel } from '../api/institutions';
import { useLibrary, useLibraryBrowse } from '../api/publications';
import type { LibraryBrowse, LibraryParams } from '../types/publications';
import { PageHeader } from '../components/layout/PageHeader';
import { FollowButton } from '../components/people/FollowButton';
import { PublicationEntry } from '../components/publications/PublicationEntry';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { SelectField } from '../components/ui/Field';
import { Sheet } from '../components/ui/Sheet';
import { Skeleton } from '../components/ui/Skeleton';
import { useDebounced } from '../lib/useDebounced';
import { plural } from '../lib/format';
import styles from './LibraryPage.module.css';

const FILTERS = ['year', 'institution', 'dept', 'keyword'] as const;

export function LibraryPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const term = useDebounced(q, 250);
  const filters: LibraryParams = { q: term, year: params.get('year') ?? '', institution: params.get('institution') ?? '', dept: params.get('dept') ?? '', keyword: params.get('keyword') ?? '' };
  const { data, isPending, isFetching } = useLibrary(filters);
  const { data: browse } = useLibraryBrowse();
  const { data: me } = useMe();
  const narrowed = FILTERS.some((k) => filters[k]);

  const set = (key: 'q' | (typeof FILTERS)[number], value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const clearFilters = () =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        FILTERS.forEach((k) => next.delete(k));
        return next;
      },
      { replace: true },
    );

  // A keyword reached from a publication's tag may be outside the most-used list: keep it selectable
  const keywords = browse
    ? filters.keyword && !browse.keywords.some((k) => k.name === filters.keyword)
      ? [{ name: filters.keyword, count: 0 }, ...browse.keywords]
      : browse.keywords
    : [];

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
            onChange={(e) => set('q', e.target.value)}
          />
        </div>

        <div className={styles.filters}>
          <SelectField label="Year" value={filters.year} onChange={(e) => set('year', e.target.value)} className={styles.filter}>
            <option value="">Any year</option>
            {browse?.years.map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </SelectField>
          {(browse?.institutions.length ?? 0) > 1 && (
            <SelectField label="School" value={filters.institution} onChange={(e) => set('institution', e.target.value)} className={styles.filter}>
              <option value="">Every school</option>
              {browse!.institutions.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {schoolLabel(s)}
                </option>
              ))}
            </SelectField>
          )}
          <SelectField label="Department" value={filters.dept} onChange={(e) => set('dept', e.target.value)} className={styles.filter}>
            <option value="">All departments</option>
            {browse?.departments
              .filter((d) => (d.research > 0 || String(d.id) === filters.dept) && (!filters.institution || String(d.institution?.id ?? '') === filters.institution))
              .map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {departmentLabel(d)}
                </option>
              ))}
          </SelectField>
          <SelectField label="Keyword" value={filters.keyword} onChange={(e) => set('keyword', e.target.value)} className={styles.filter}>
            <option value="">Any keyword</option>
            {keywords.map((k) => (
              <option key={k.name} value={k.name}>
                {k.count ? `${k.name} (${k.count})` : k.name}
              </option>
            ))}
          </SelectField>
          {me && filters.dept && <FollowButton kind="department" target={filters.dept} label={departmentName(browse, filters.dept)} />}
          {narrowed && (
            <Button variant="ghost" icon={<X size={16} aria-hidden="true" />} onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        {!narrowed && !term && browse && browse.departments.length > 0 && <Departments departments={browse.departments} onPick={(d) => set('dept', String(d))} />}

        {isPending ? (
          <>
            <Skeleton className={styles.skeleton} />
            <Skeleton className={styles.skeleton} />
          </>
        ) : !data?.length ? (
          <EmptyState title={term || narrowed ? 'Nothing matches' : 'No published research yet'}>
            {term || narrowed ? 'Try another keyword, year or department.' : 'When educators publish their research, it appears here.'}
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

/** The department's name with its school, for the Follow button. */
function departmentName(browse: LibraryBrowse | undefined, id: string) {
  const d = browse?.departments.find((x) => String(x.id) === id);
  return d ? departmentLabel(d) : 'this department';
}

/** Browse by department: how much educator research and how many student works each one has. */
function Departments({ departments, onPick }: { departments: LibraryBrowse['departments']; onPick: (id: number) => void }) {
  return (
    <Sheet title="Browse by department" aside={String(departments.length)} flush>
      <ul className={styles.departments}>
        {departments.map((d) => (
          <li key={d.id} className={styles.department}>
            <Building2 size={18} aria-hidden="true" className={styles.departmentIcon} />
            <span className={styles.departmentText}>
              <span className={styles.departmentName}>{departmentLabel(d)}</span>
              <span className={styles.departmentLinks}>
                {d.research > 0 ? (
                  <button type="button" className={styles.departmentLink} onClick={() => onPick(d.id)}>
                    {plural(d.research, 'publication')}
                  </button>
                ) : (
                  <span>No publications</span>
                )}
                <span aria-hidden="true">·</span>
                {d.works > 0 ? (
                  <Link to={`/feed?dept=${d.id}`} className={styles.departmentLink}>
                    {plural(d.works, 'student work')}
                  </Link>
                ) : (
                  <span>No student works</span>
                )}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
