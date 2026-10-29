/**
 * Button — the shared button and button-styled link used across the app.
 * Both take the same variant, size, block and icon props; Button also shows a spinner while loading.
 */
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { LoaderCircle } from 'lucide-react';
import clsx from 'clsx';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'ink' | 'danger' | 'ok';
interface Common {
  variant?: Variant;
  size?: 'md' | 'lg';
  block?: boolean;
  icon?: ReactNode;
}

const cls = ({ variant = 'secondary', size = 'md', block }: Common, extra?: string) =>
  clsx(styles.button, styles[variant], size === 'lg' && styles.lg, block && styles.block, extra);

export const Button = forwardRef<
  HTMLButtonElement,
  Common & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }
>(function Button({ variant, size, block, icon, loading, className, children, disabled, type = 'button', ...rest }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      className={cls({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <LoaderCircle className={styles.spin} size={18} aria-hidden="true" /> : icon}
      {children}
    </button>
  );
});

/** A router Link that looks like a Button, for navigation actions. */
export function ButtonLink({ variant, size, block, icon, className, children, ...rest }: Common & LinkProps) {
  return (
    <Link className={cls({ variant, size, block }, className)} {...rest}>
      {icon}
      {children}
    </Link>
  );
}
