/**
 * RichTextEditor — a textarea with a formatting toolbar (bold, italic, heading, lists, link)
 * and a Preview tab. It writes the light markup that RichText renders.
 */
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import { Bold, Eye, Heading2, Italic, Link2, List, ListOrdered, PenLine } from 'lucide-react';
import { Segmented } from '../ui/Segmented';
import { RichText } from './RichText';
import styles from './RichTextEditor.module.css';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  maxLength?: number;
  placeholder?: string;
}

export function RichTextEditor({ label, value, onChange, error, maxLength = 10000, placeholder }: Props) {
  const id = useId();
  const area = useRef<HTMLTextAreaElement>(null);
  const [mode, setMode] = useState<'write' | 'preview'>('write');

  /** Replaces the selection with `insert`, then reselects the part named by [from, to] within it. */
  const apply = (make: (selected: string) => { insert: string; select?: [number, number] }, wholeLines = false) => {
    const el = area.current;
    if (!el) return;
    let start = el.selectionStart;
    let end = el.selectionEnd;
    if (wholeLines) {
      start = value.lastIndexOf('\n', start - 1) + 1;
      const nl = value.indexOf('\n', end);
      end = nl === -1 ? value.length : nl;
    }
    const { insert, select } = make(value.slice(start, end));
    onChange(value.slice(0, start) + insert + value.slice(end));
    requestAnimationFrame(() => {
      el.focus();
      const [a, b] = select ?? [insert.length, insert.length];
      el.setSelectionRange(start + a, start + b);
    });
  };

  const wrap = (mark: string, fallback: string) =>
    apply((sel) => {
      const text = sel || fallback;
      return { insert: `${mark}${text}${mark}`, select: [mark.length, mark.length + text.length] };
    });
  const prefixLines = (prefix: (i: number) => string) =>
    apply((sel) => ({ insert: sel.split('\n').map((l, i) => `${prefix(i)}${l.replace(/^(#{2,3}|[-*]|\d+[.)])\s+/, '')}`).join('\n') }), true);

  const tools = [
    { label: 'Bold', icon: Bold, keys: 'b', run: () => wrap('**', 'bold text') },
    { label: 'Italic', icon: Italic, keys: 'i', run: () => wrap('_', 'italic text') },
    { label: 'Heading', icon: Heading2, run: () => prefixLines(() => '## ') },
    { label: 'Bulleted list', icon: List, run: () => prefixLines(() => '- ') },
    { label: 'Numbered list', icon: ListOrdered, run: () => prefixLines((i) => `${i + 1}. `) },
    {
      label: 'Link',
      icon: Link2,
      keys: 'k',
      run: () =>
        apply((sel) => {
          const text = sel || 'link text';
          return { insert: `[${text}](https://)`, select: [text.length + 3, text.length + 11] };
        }),
    },
  ];

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const tool = tools.find((t) => t.keys === e.key.toLowerCase());
    if (tool) {
      e.preventDefault();
      tool.run();
    }
  };

  return (
    <div className={styles.editor}>
      <div className={styles.top}>
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
        <Segmented
          label="Editor mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'write', label: 'Write', icon: <PenLine size={14} aria-hidden="true" /> },
            { value: 'preview', label: 'Preview', icon: <Eye size={14} aria-hidden="true" /> },
          ]}
        />
      </div>
      <div className={styles.box} data-invalid={error ? true : undefined}>
        {mode === 'write' ? (
          <>
            <div className={styles.toolbar} role="toolbar" aria-label="Formatting" aria-controls={id}>
              {tools.map((t) => (
                <button key={t.label} type="button" className={styles.tool} onClick={t.run} title={t.keys ? `${t.label} (⌘/Ctrl+${t.keys.toUpperCase()})` : t.label}>
                  <t.icon size={17} aria-hidden="true" />
                  <span className="sr-only">{t.label}</span>
                </button>
              ))}
            </div>
            <textarea
              id={id}
              ref={area}
              className={styles.area}
              value={value}
              maxLength={maxLength}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
              onKeyDown={onKeyDown}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-note`}
            />
          </>
        ) : (
          <div className={styles.preview}>{value.trim() ? <RichText source={value} /> : <p className={styles.nothing}>Nothing to preview yet.</p>}</div>
        )}
      </div>
      {error ? (
        <p id={`${id}-note`} className={styles.error} role="alert">
          {error}
        </p>
      ) : (
        <p id={`${id}-note`} className={styles.hint}>
          **bold**, _italic_, “## ” heading, “- ” list, [link](https://…)
        </p>
      )}
    </div>
  );
}
