/**
 * RecoveryCodes — the one-time codes that sign in when the authenticator app is lost,
 * with copy and download so they can be kept somewhere safe.
 */
import { Copy, Download } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import styles from './Account.module.css';

export function RecoveryCodes({ codes }: { codes: string[] }) {
  const toast = useToast();
  const text = `Tuklas recovery codes. Each one works once.\n\n${codes.join('\n')}\n`;

  const copy = () =>
    navigator.clipboard.writeText(text).then(
      () => toast('Recovery codes copied.', 'success'),
      () => toast('Couldn’t copy. Select the codes and copy them by hand.', 'error'),
    );

  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tuklas-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className={styles.form}>
      <ul className={styles.codes} aria-label="Recovery codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className={styles.actions}>
        <Button icon={<Copy size={16} aria-hidden="true" />} onClick={copy}>
          Copy
        </Button>
        <Button icon={<Download size={16} aria-hidden="true" />} onClick={download}>
          Download
        </Button>
      </div>
    </div>
  );
}
