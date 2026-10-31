/**
 * PrivacyNotice — what Tuklas collects, why, who sees it and the person's rights under the
 * Data Privacy Act of 2012 (RA 10173).
 * The final wording must be approved with the Data Protection Officer before launch (docs/TODO.md).
 * When it changes, bump PRIVACY_VERSION here and `privacy_version` in config/tuklas.php together:
 * everyone is then asked to accept the new version.
 */
import clsx from 'clsx';
import styles from './Account.module.css';

export const PRIVACY_VERSION = '2026-10-30';

export function PrivacyNotice({ full = false }: { full?: boolean }) {
  return (
    <div className={clsx(styles.notice, full && styles.full)} tabIndex={full ? undefined : 0} aria-label="Privacy notice">
      <p className={styles.muted}>Version {PRIVACY_VERSION}</p>
      <h3>What we collect</h3>
      <ul>
        <li>Your account: name, school email, role, program or department, and your password (stored only as a one-way hash).</li>
        <li>What you add: your portfolio, research works and their versions, comments, reviews, messages, group files, event registrations and applications.</li>
        <li>Security records: where and when you signed in (IP address and browser) and important account actions, kept to protect your account.</li>
      </ul>
      <h3>Why</h3>
      <ul>
        <li>To run Tuklas: showing your work, adviser review and approval, research groups, messages, events and notifications.</li>
        <li>To keep accounts safe and to investigate misuse.</li>
      </ul>
      <h3>Who sees it</h3>
      <ul>
        <li>Works you make public, after an adviser or the panel approves them, and your public portfolio can be seen by anyone.</li>
        <li>Drafts and works under review are seen only by you, your co-authors, your reviewers and the Office of Research. Messages are seen only by the people in the conversation, and are stored encrypted.</li>
        <li>Administrators of the Office of Research can see account details to verify educators and moderate the hub.</li>
        <li>We don’t sell your data or share it with advertisers.</li>
      </ul>
      <h3>Your rights</h3>
      <ul>
        <li>See and download what we hold about you: “Download my data” on your Account page.</li>
        <li>Correct it: edit your portfolio at any time.</li>
        <li>Ask for it to be erased, object to its use, or withdraw consent: contact the Office of Research.</li>
        <li>Complain to the National Privacy Commission if you think your data was mishandled.</li>
      </ul>
    </div>
  );
}
