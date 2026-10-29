/**
 * Person — small blocks that show people and link to their public portfolios.
 * Exports Person (avatar and name) and Byline (a list of names).
 */
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import type { UserCard } from '@server/schemas/common';
import { Avatar } from '../ui/Avatar';
import styles from './Person.module.css';

/** Avatar, name and a second line, linking to the person's public portfolio. */
export function Person({
  user,
  sub,
  size = 'md',
  link = true,
  className,
}: {
  user: UserCard;
  /** Second line; defaults to their program */
  sub?: ReactNode;
  size?: 'sm' | 'md';
  link?: boolean;
  className?: string;
}) {
  const body = (
    <>
      <Avatar name={user.name} role={user.role} photo={user.photoUrl} size={size} />
      <span className={styles.text}>
        <span className={styles.name}>{user.name}</span>
        <span className={styles.sub}>{sub ?? user.program}</span>
      </span>
    </>
  );
  return link ? (
    <Link to={`/u/${user.username}`} className={clsx(styles.person, styles.link, className)}>
      {body}
    </Link>
  ) : (
    <span className={clsx(styles.person, className)}>{body}</span>
  );
}

/** "Andrea Villanueva, Kim Dela Cruz", each linking to their portfolio. */
export function Byline({ users }: { users: UserCard[] }) {
  return (
    <span className={styles.byline}>
      {users.map((u, i) => (
        <span key={u.id}>
          {i > 0 && (i === users.length - 1 ? ' and ' : ', ')}
          <Link to={`/u/${u.username}`} className={styles.bylineName}>
            {u.name}
          </Link>
        </span>
      ))}
    </span>
  );
}
