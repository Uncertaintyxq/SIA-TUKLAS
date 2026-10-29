/**
 * Field — labeled form controls: text input, select, text area and file picker.
 * Each wires its label, hint and error note to the control for screen readers.
 */
import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';
import styles from './Field.module.css';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
}

export function TextField({ label, hint, error, className, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={clsx(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={styles.control}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        {...input}
      />
      <Note id={`${id}-note`} hint={hint} error={error} />
    </div>
  );
}

export function SelectField({
  label,
  hint,
  error,
  className,
  children,
  ...select
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={clsx(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <select id={id} className={clsx(styles.control, styles.select)} aria-describedby={hint ? `${id}-note` : undefined} {...select}>
        {children}
      </select>
      <Note id={`${id}-note`} hint={hint} error={error} />
    </div>
  );
}

export function TextAreaField({ label, hint, error, className, ...area }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={clsx(styles.field, className)}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <textarea
        id={id}
        className={clsx(styles.control, styles.area)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-note` : undefined}
        {...area}
      />
      <Note id={`${id}-note`} hint={hint} error={error} />
    </div>
  );
}

/** A labelled file picker: a real file input, styled as a button, with the chosen name beside it. */
export function FileField({
  label,
  hint,
  accept,
  file,
  onFile,
  buttonLabel = 'Choose file',
}: {
  label: string;
  hint?: ReactNode;
  accept?: string;
  file: File | null;
  onFile: (f: File | null) => void;
  buttonLabel?: string;
}) {
  const id = useId();
  return (
    <div className={styles.field}>
      <span className={styles.label} id={`${id}-label`}>
        {label}
      </span>
      <div className={styles.fileRow}>
        <label className={styles.fileButton} htmlFor={id}>
          {buttonLabel}
        </label>
        <input
          id={id}
          type="file"
          accept={accept}
          className="sr-only"
          aria-labelledby={`${id}-label`}
          aria-describedby={hint ? `${id}-note` : undefined}
          onChange={(e) => onFile(e.target.files?.[0] ?? null)}
        />
        <span className={styles.fileName}>{file ? file.name : 'No file chosen'}</span>
      </div>
      <Note id={`${id}-note`} hint={hint} />
    </div>
  );
}

function Note({ id, hint, error }: { id: string; hint?: ReactNode; error?: string }) {
  if (error) return <p id={id} className={styles.error} role="alert">{error}</p>;
  if (hint) return <p id={id} className={styles.hint}>{hint}</p>;
  return null;
}
