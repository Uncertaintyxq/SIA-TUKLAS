/**
 * OpportunityEntry — a feed entry for an adviser's opportunity, with apply and withdraw.
 * Admins and the posting adviser see the entry without the apply controls.
 */
import { useState, type FormEvent } from 'react';
import { CalendarClock, Check, Users } from 'lucide-react';
import type { OpportunityCard } from '@server/schemas/feed';
import { useMe } from '../../api/auth';
import { useApply, useWithdraw } from '../../api/feed';
import { fmtDate, plural, relTime } from '../../lib/format';
import { opportunityLabel } from '../../lib/labels';
import { Person } from '../people/Person';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { TextAreaField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import styles from './OpportunityEntry.module.css';

/** An adviser's opportunity in the feed; students apply from here. */
export function OpportunityEntry({ opportunity: o }: { opportunity: OpportunityCard }) {
  const { data: me } = useMe();
  const [applying, setApplying] = useState(false);
  const withdraw = useWithdraw();
  const toast = useToast();
  const canApply = me && me.role !== 'admin' && !o.isOwner;

  return (
    <article className={styles.entry}>
      <div className={styles.head}>
        <Person user={o.adviser} sub={`posted an opportunity · ${relTime(o.createdAt)}`} />
        <Badge tone="blue">{opportunityLabel[o.kind]}</Badge>
      </div>
      <h3 className={styles.title}>{o.title}</h3>
      <p className={styles.description}>{o.description}</p>
      <div className={styles.foot}>
        <span className={styles.fact}>
          <CalendarClock size={15} aria-hidden="true" />
          Apply by {fmtDate(o.deadline)}
        </span>
        {o.slots && (
          <span className={styles.fact}>
            <Users size={15} aria-hidden="true" />
            {plural(o.slots, 'slot')}
          </span>
        )}
        {canApply &&
          (o.applied ? (
            <span className={styles.applied}>
              <Badge tone="ok" icon={<Check size={13} aria-hidden="true" />}>
                Applied
              </Badge>
              <Button
                variant="ghost"
                loading={withdraw.isPending}
                onClick={() => withdraw.mutate(o.id, { onSuccess: () => toast('Application withdrawn.'), onError: (e) => toast(e.message, 'error') })}
              >
                Withdraw
              </Button>
            </span>
          ) : (
            <Button variant="primary" className={styles.apply} onClick={() => setApplying(true)}>
              Apply
            </Button>
          ))}
      </div>
      {canApply && <ApplyForm key={String(applying)} open={applying} onClose={() => setApplying(false)} opportunity={o} />}
    </article>
  );
}

function ApplyForm({ open, onClose, opportunity: o }: { open: boolean; onClose: () => void; opportunity: OpportunityCard }) {
  const [message, setMessage] = useState('');
  const apply = useApply();
  const toast = useToast();
  const submit = (e: FormEvent) => {
    e.preventDefault();
    apply.mutate(
      { id: o.id, message },
      {
        onSuccess: () => {
          toast(`Application sent to ${o.adviser.name}.`, 'success');
          onClose();
        },
      },
    );
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Apply: ${o.title}`}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="apply-form" variant="primary" loading={apply.isPending}>
            Send application
          </Button>
        </>
      }
    >
      <form id="apply-form" className={styles.form} onSubmit={submit}>
        <TextAreaField
          label={`Message to ${o.adviser.name}`}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={5}
          minLength={10}
          maxLength={1000}
          required
          hint="Say why you’re interested and what you’d bring. Your portfolio is linked automatically."
          error={apply.error?.message}
        />
      </form>
    </Modal>
  );
}
