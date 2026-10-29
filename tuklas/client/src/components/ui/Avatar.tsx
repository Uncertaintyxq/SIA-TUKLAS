/**
 * Avatar — the round picture shown next to a person's name.
 */
import clsx from 'clsx';
import type { Role } from '@server/schemas/auth';
import { initials } from '../../lib/format';
import styles from './Avatar.module.css';

/** Initials on the role colour, or the person's uploaded photo when they have one. */
export function Avatar({ name, role, size = 'md', photo }: { name: string; role: Role; size?: 'sm' | 'md' | 'lg'; photo?: string | null }) {
  return (
    <span className={clsx(styles.avatar, styles[role], styles[size])} aria-hidden="true">
      {photo ? <img src={photo} alt="" className={styles.photo} /> : initials(name)}
    </span>
  );
}
