/**
 * PeoplePicker — a name search for adding co-authors, advisers or members.
 * Hides people already picked and, when given, people outside the allowed roles.
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { Role } from '@server/schemas/auth';
import type { UserCard } from '@server/schemas/common';
import { usePeopleSearch } from '../../api/portfolio';
import { useDebounced } from '../../lib/useDebounced';
import { roleBadge } from '../../lib/labels';
import { TextField } from '../ui/Field';
import { Person } from './Person';
import styles from './PeoplePicker.module.css';

/** Search by name, then add from a short list of matches. */
export function PeoplePicker({
  label,
  roles,
  exclude,
  onPick,
  hint,
}: {
  label: string;
  /** Only people with these roles can be picked */
  roles?: Role[];
  exclude: number[];
  onPick: (u: UserCard) => void;
  hint?: string;
}) {
  const [q, setQ] = useState('');
  const term = useDebounced(q, 250);
  const { data, isFetching } = usePeopleSearch(term);
  const results = (data ?? []).filter((u) => !exclude.includes(u.id) && (!roles || roles.includes(u.role)));
  const searching = term.trim().length >= 2;

  return (
    <div className={styles.picker}>
      <TextField label={label} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type at least 2 letters of a name" hint={hint} autoComplete="off" />
      {searching && (
        <ul className={styles.results} aria-live="polite" aria-busy={isFetching}>
          {results.map((u) => (
            <li key={u.id} className={styles.result}>
              <Person user={u} link={false} size="sm" sub={`${roleBadge(u)} · ${u.program}`} />
              <button
                type="button"
                className={styles.add}
                onClick={() => {
                  onPick(u);
                  setQ('');
                }}
              >
                <Plus size={16} aria-hidden="true" />
                Add<span className="sr-only"> {u.name}</span>
              </button>
            </li>
          ))}
          {!isFetching && results.length === 0 && <li className={styles.none}>No one matches “{term}”.</li>}
        </ul>
      )}
    </div>
  );
}
