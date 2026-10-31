/**
 * PostOpportunityPage — the "/post" page where educators post opportunities to the community feed.
 * Educators must be verified by an admin before they can post; they can also delete their own postings here.
 */
import { useState, type FormEvent } from 'react';
import { ShieldAlert, Trash2 } from 'lucide-react';
import type { OpportunityKind } from '../types/feed';
import { useMe } from '../api/auth';
import { useCreateOpportunity, useDeleteOpportunity, useMyOpportunities } from '../api/feed';
import { PageHeader } from '../components/layout/PageHeader';
import { Person } from '../components/people/Person';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { SelectField, TextAreaField, TextField } from '../components/ui/Field';
import { Notice } from '../components/ui/Notice';
import { Sheet, SheetEmpty } from '../components/ui/Sheet';
import { useToast } from '../components/ui/Toast';
import { fmtDate, isoDate, plural, relTime } from '../lib/format';
import { opportunityLabel } from '../lib/labels';
import styles from './PostOpportunityPage.module.css';

const inThreeWeeks = () => isoDate(new Date(Date.now() + 21 * 86_400_000).toISOString());

export function PostOpportunityPage() {
  const { data: me } = useMe();
  const { data: mine } = useMyOpportunities();
  const create = useCreateOpportunity();
  const remove = useDeleteOpportunity();
  const toast = useToast();
  const [kind, setKind] = useState<OpportunityKind>('mentorship');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState(inThreeWeeks);
  const [slots, setSlots] = useState('');
  const unverified = me?.role === 'educator' && !me.verified;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { kind, title, description, deadline: `${deadline}T23:59:00`, slots: slots ? Number(slots) : null },
      {
        onSuccess: () => {
          toast('Opportunity published to the feed.', 'success');
          setTitle('');
          setDescription('');
          setSlots('');
        },
      },
    );
  };

  return (
    <>
      <PageHeader title="Post an opportunity" description="Invite students to mentorships, research grants or calls for submissions. Posts appear in the community feed, and students apply from there." />
      {unverified && (
        <Notice tone="warn" icon={<ShieldAlert size={18} aria-hidden="true" />} className={styles.notice}>
          An admin needs to verify your educator account before you can post opportunities.
        </Notice>
      )}
      <div className={styles.layout}>
        <Sheet title="New posting">
          <form className={styles.form} onSubmit={submit}>
            <SelectField label="Type" value={kind} onChange={(e) => setKind(e.target.value as OpportunityKind)}>
              {(Object.keys(opportunityLabel) as OpportunityKind[]).map((k) => (
                <option key={k} value={k}>
                  {opportunityLabel[k]}
                </option>
              ))}
            </SelectField>
            <TextField label="Title" value={title} onChange={(e) => setTitle(e.target.value)} required minLength={5} maxLength={140} placeholder="e.g. Research assistants for the Coastal Ecology Lab" />
            <TextAreaField
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              minLength={20}
              rows={6}
              placeholder="Who should apply, what they will do, and what they gain."
            />
            <div className={styles.row}>
              <TextField label="Application deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
              <TextField label="Slots (optional)" type="number" min={1} max={99} value={slots} onChange={(e) => setSlots(e.target.value)} />
            </div>
            {create.error && (
              <p className={styles.error} role="alert">
                {create.error.message}
              </p>
            )}
            <div className={styles.submit}>
              <Button type="submit" variant="primary" loading={create.isPending} disabled={unverified}>
                Publish to feed
              </Button>
            </div>
          </form>
        </Sheet>

        <Sheet title="Your postings" aside={String(mine?.length ?? 0)} flush>
          {!mine?.length ? (
            <SheetEmpty>No postings yet.</SheetEmpty>
          ) : (
            <ul className={styles.postings}>
              {mine.map((o) => (
                <li key={o.id} className={styles.posting}>
                  <div className={styles.postingHead}>
                    <Badge tone="blue">{opportunityLabel[o.kind]}</Badge>
                    <span className={styles.closes}>Closes {fmtDate(o.deadline)}</span>
                  </div>
                  <h3 className={styles.postingTitle}>{o.title}</h3>
                  <details className={styles.applicants}>
                    <summary>{plural(o.applications.length, 'applicant')}</summary>
                    {o.applications.length === 0 ? (
                      <p className={styles.quiet}>No applications yet.</p>
                    ) : (
                      <ul className={styles.applicantList}>
                        {o.applications.map((a) => (
                          <li key={a.user.id} className={styles.applicant}>
                            <Person user={a.user} size="sm" sub={`Applied ${relTime(a.createdAt)}`} />
                            <p className={styles.message}>{a.message}</p>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                  <Button
                    variant="danger"
                    icon={<Trash2 size={16} aria-hidden="true" />}
                    onClick={() => window.confirm(`Remove “${o.title}” from the feed?`) && remove.mutate(o.id, { onSuccess: () => toast('Posting removed.') })}
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Sheet>
      </div>
    </>
  );
}
