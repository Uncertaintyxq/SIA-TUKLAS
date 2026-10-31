/**
 * PrivacyPage — "/privacy": the privacy notice, open to everyone (linked from signup).
 */
import { PageHeader } from '../components/layout/PageHeader';
import { PrivacyNotice } from '../components/account/PrivacyNotice';
import { Sheet } from '../components/ui/Sheet';

export function PrivacyPage() {
  return (
    <>
      <PageHeader title="Privacy notice" description="How Tuklas handles your personal data, under the Data Privacy Act of 2012 (RA 10173)." />
      <Sheet>
        <PrivacyNotice full />
      </Sheet>
    </>
  );
}
