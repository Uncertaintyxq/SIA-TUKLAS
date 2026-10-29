/**
 * EmptyState — the placeholder shown when a list has nothing to show yet.
 * Pairs a Tuko mascot pose with a title, an optional note and an optional action.
 */
import type { ReactNode } from 'react';
import { Tuko, type TukoPose } from '../brand/Tuko';
import styles from './EmptyState.module.css';

export function EmptyState({ title, children, pose = 'idle', action }: { title: string; children?: ReactNode; pose?: TukoPose; action?: ReactNode }) {
  return (
    <div className={styles.empty}>
      <Tuko pose={pose} size={120} />
      <h2 className={styles.title}>{title}</h2>
      {children && <p className={styles.text}>{children}</p>}
      {action}
    </div>
  );
}
