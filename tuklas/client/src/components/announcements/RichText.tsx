/**
 * RichText — renders an announcement's light markup as React elements (never as HTML, so nothing
 * a writer types can run as code). Supports **bold**, _italic_, "## " headings, "- " and "1. " lists,
 * and [text](https://…) links.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './RichText.module.css';

const INLINE = /(\*\*[^*\n]+\*\*|_[^_\n]+_|\[[^\]\n]+\]\(https?:\/\/[^)\s]+\))/g;

/** Bold, italic and links inside one line. */
function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(part);
    if (link)
      return (
        <a key={i} href={link[2]} target="_blank" rel="noreferrer noopener">
          {link[1]}
        </a>
      );
    return part;
  });
}

type Block =
  | { kind: 'heading'; text: string }
  | { kind: 'list'; ordered: boolean; items: string[] }
  | { kind: 'p'; lines: string[] };

/** Splits the text into headings, lists and paragraphs. */
function blocks(source: string): Block[] {
  const out: Block[] = [];
  for (const raw of source.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    const last = out.at(-1);
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const numbered = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) {
      out.push({ kind: 'p', lines: [] });
    } else if (/^#{2,3}\s+/.test(line)) {
      out.push({ kind: 'heading', text: line.replace(/^#{2,3}\s+/, '') });
    } else if (bullet || numbered) {
      const ordered = Boolean(numbered);
      const item = (bullet ?? numbered)![1]!;
      if (last?.kind === 'list' && last.ordered === ordered) last.items.push(item);
      else out.push({ kind: 'list', ordered, items: [item] });
    } else if (last?.kind === 'p') {
      last.lines.push(line);
    } else {
      out.push({ kind: 'p', lines: [line] });
    }
  }
  return out.filter((b) => b.kind !== 'p' || b.lines.length > 0);
}

export function RichText({ source, className }: { source: string; className?: string }) {
  return (
    <div className={clsx(styles.text, className)}>
      {blocks(source).map((b, i) => {
        if (b.kind === 'heading') return <h3 key={i}>{inline(b.text)}</h3>;
        if (b.kind === 'list') {
          const List = b.ordered ? 'ol' : 'ul';
          return (
            <List key={i}>
              {b.items.map((item, j) => (
                <li key={j}>{inline(item)}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={i}>
            {b.lines.map((l, j) => (
              <span key={j}>
                {j > 0 && <br />}
                {inline(l)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
