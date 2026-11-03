/**
 * useMentionPicker — adds @mention suggestions to a textarea. Typing "@" and two letters lists
 * matching people (the people search); ↑/↓ choose, Enter or Tab insert "@username ", Esc closes.
 * The textarea keeps its own label and behaviour: spread `textareaProps` on it, call `onKeyDown`
 * first in its key handler (it returns true when it used the key), and render `list` next to it
 * inside an element with the `anchor` class.
 */
import { useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type SyntheticEvent } from 'react';
import clsx from 'clsx';
import { usePeopleSearch } from '../../api/portfolio';
import { useDebounced } from '../../lib/useDebounced';
import { Avatar } from './Avatar';
import styles from './MentionInput.module.css';

/** The "@term" being typed just before the caret, if any (same username shape as the server). */
function queryAt(text: string, caret: number) {
  const m = /(^|[^A-Za-z0-9_.@])@([a-z0-9][a-z0-9-]{0,39})$/i.exec(text.slice(0, caret));
  return m ? { start: caret - m[2]!.length - 1, term: m[2]! } : null;
}

export function useMentionPicker(value: string, onChange: (value: string) => void, placement: 'above' | 'below' = 'below') {
  const ref = useRef<HTMLTextAreaElement>(null);
  const listId = useId();
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  // The "@" a person pressed Esc on: its suggestions stay closed until they type elsewhere
  const [dismissed, setDismissed] = useState<number | null>(null);

  const query = queryAt(value, caret);
  const term = useDebounced(query?.term ?? '', 200);
  const { data } = usePeopleSearch(query ? term : '');
  const people = query && query.start !== dismissed && term.length >= 2 ? (data ?? []).slice(0, 6) : [];
  const open = people.length > 0;
  const current = Math.min(active, people.length - 1);

  const pick = (username: string) => {
    if (!query) return;
    const insert = `@${username} `;
    const next = value.slice(0, query.start) + insert + value.slice(caret);
    const position = query.start + insert.length;
    onChange(next);
    setCaret(position);
    requestAnimationFrame(() => {
      ref.current?.focus();
      ref.current?.setSelectionRange(position, position);
    });
  };

  const track = (e: SyntheticEvent<HTMLTextAreaElement>) => setCaret(e.currentTarget.selectionStart);

  /** Handles the picker's keys; returns true when it used the key (so Enter doesn't also send). */
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || e.nativeEvent.isComposing) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      setActive((current + (e.key === 'ArrowDown' ? 1 : people.length - 1)) % people.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      pick(people[current]!.username);
    } else if (e.key === 'Escape') {
      setDismissed(query!.start);
    } else {
      return false;
    }
    e.preventDefault();
    return true;
  };

  return {
    anchor: styles.anchor,
    onKeyDown,
    textareaProps: {
      ref,
      onChange: (e: ChangeEvent<HTMLTextAreaElement>) => {
        onChange(e.target.value);
        setCaret(e.target.selectionStart);
        setActive(0);
      },
      onSelect: track,
      onClick: track,
      'aria-autocomplete': 'list' as const,
      'aria-expanded': open,
      'aria-controls': open ? listId : undefined,
      'aria-activedescendant': open ? `${listId}-${current}` : undefined,
    },
    list: open ? (
      <ul id={listId} role="listbox" aria-label="People to mention" className={clsx(styles.list, styles[placement])}>
        {people.map((u, i) => (
          <li
            key={u.id}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === current}
            className={styles.option}
            // mousedown, so the textarea keeps focus and the caret position
            onMouseDown={(e) => {
              e.preventDefault();
              pick(u.username);
            }}
          >
            <Avatar name={u.name} role={u.role} photo={u.photoUrl} size="sm" />
            <span className={styles.who}>
              <span className={styles.name}>{u.name}</span>
              <span className={styles.handle}>@{u.username}</span>
            </span>
          </li>
        ))}
      </ul>
    ) : null,
  };
}
