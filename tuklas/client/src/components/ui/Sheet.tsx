/**
 * Sheet — the ruled notebook section that frames most page content.
 * Also exports SheetRow for edge-to-edge rows and SheetEmpty for the empty state.
 */
import type { ReactNode } from 'react';
import clsx from 'clsx';
import styles from './Sheet.module.css';

/** A notebook sheet: a ruled section with an optional heading row. */
export function Sheet({
  title,
  aside,
  actions,
  children,
  flush = false,
  className,
  id,
  as: Tag = 'section',
}: {
  title?: ReactNode;
  /** Small text beside the title, e.g. a count */
  aside?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  /** No body padding: rows run edge to edge */
  flush?: boolean;
  className?: string;
  id?: string;
  as?: 'section' | 'article' | 'aside' | 'div';
}) {
  return (
    <Tag className={clsx(styles.sheet, className)} id={id}>
      {(title || actions) && (
        <header className={styles.head}>
          <div className={styles.titleRow}>
            {title && <h2 className={styles.title}>{title}</h2>}
            {aside && <span className={styles.aside}>{aside}</span>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      <div className={clsx(!flush && styles.body)}>{children}</div>
    </Tag>
  );
}

/** One row in a flush sheet. */
export function SheetRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx(styles.row, className)}>{children}</div>;
}

/** The quiet line shown when a sheet has nothing in it yet. */
export function SheetEmpty({ children }: { children: ReactNode }) {
  return <p className={styles.empty}>{children}</p>;
}
