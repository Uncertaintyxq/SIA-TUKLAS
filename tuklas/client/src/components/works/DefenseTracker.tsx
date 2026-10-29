/**
 * DefenseTracker — the dated list of a work's defense stages, from proposal to published.
 * Authors can add, edit and remove stages; readers see the list only when it has entries.
 */
import { useState, type FormEvent } from 'react';
import clsx from 'clsx';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { DefenseStageKind, StageView, Verdict } from '@server/schemas/works';
import { useDeleteStage, useSaveStage } from '../../api/works';
import { isoDate } from '../../lib/format';
import { stageLabel, verdictLabel } from '../../lib/labels';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { SelectField, TextField } from '../ui/Field';
import { Modal } from '../ui/Modal';
import { Sheet } from '../ui/Sheet';
import { useToast } from '../ui/Toast';
import styles from './DefenseTracker.module.css';

const verdictTone: Record<Verdict, BadgeTone> = { pending: 'neutral', passed: 'ok', passed_with_revisions: 'warn', failed: 'bad' };

// ---------- Stage timeline ----------

/** Defense tracker: the thesis journey as dated notebook entries, from proposal to published. */
export function DefenseTracker({ workId, stages, editable }: { workId: number; stages: StageView[]; editable: boolean }) {
  const [editing, setEditing] = useState<StageView | 'new' | null>(null);
  const [formKey, setFormKey] = useState(0);
  const remove = useDeleteStage();
  const toast = useToast();
  const now = Date.now();

  const open = (s: StageView | 'new') => {
    setFormKey((k) => k + 1);
    setEditing(s);
  };

  if (!editable && stages.length === 0) return null;

  return (
    <Sheet
      title="Defense to Discovery"
      aside={stages.length ? `${stages.length} stage${stages.length > 1 ? 's' : ''}` : undefined}
      actions={
        editable && (
          <Button icon={<Plus size={16} aria-hidden="true" />} onClick={() => open('new')}>
            Add stage
          </Button>
        )
      }
    >
      {stages.length === 0 ? (
        <p className={styles.empty}>Record the proposal defense, colloquium and final defense here, with panel names and verdicts.</p>
      ) : (
        <ol className={styles.timeline}>
          {stages.map((s) => {
            const upcoming = new Date(s.date).getTime() > now;
            return (
              <li key={s.id} className={clsx(styles.stage, upcoming && styles.upcoming, s.stage === 'published' && styles.published)}>
                <span className={styles.dot} aria-hidden="true" />
                <div className={styles.body}>
                  <div className={styles.head}>
                    <time className={styles.date}>{isoDate(s.date)}</time>
                    <h3 className={styles.name}>{stageLabel[s.stage]}</h3>
                    <Badge tone={upcoming ? 'blue' : verdictTone[s.verdict]}>{upcoming ? 'Upcoming' : verdictLabel[s.verdict]}</Badge>
                  </div>
                  {s.panel && <p className={styles.panel}>Panel: {s.panel}</p>}
                  {s.notes && <p className={styles.notes}>{s.notes}</p>}
                </div>
                {editable && (
                  <div className={styles.tools}>
                    <button type="button" className={styles.tool} onClick={() => open(s)}>
                      <Pencil size={16} aria-hidden="true" />
                      <span className="sr-only">Edit {stageLabel[s.stage]}</span>
                    </button>
                    <button
                      type="button"
                      className={styles.tool}
                      onClick={() =>
                        window.confirm(`Remove the ${stageLabel[s.stage].toLowerCase()} entry?`) &&
                        remove.mutate({ id: workId, stageId: s.id }, { onError: (e) => toast(e.message, 'error') })
                      }
                    >
                      <Trash2 size={16} aria-hidden="true" />
                      <span className="sr-only">Remove {stageLabel[s.stage]}</span>
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {editable && <StageForm key={formKey} workId={workId} stage={editing} onClose={() => setEditing(null)} />}
    </Sheet>
  );
}

// ---------- Stage form ----------

/** Modal for adding a new stage or editing an existing one. */
function StageForm({ workId, stage, onClose }: { workId: number; stage: StageView | 'new' | null; onClose: () => void }) {
  const existing = stage && stage !== 'new' ? stage : null;
  const [kind, setKind] = useState<DefenseStageKind>(existing?.stage ?? 'proposal');
  const [date, setDate] = useState(existing ? isoDate(existing.date) : isoDate(new Date().toISOString()));
  const [panel, setPanel] = useState(existing?.panel ?? '');
  const [verdict, setVerdict] = useState<Verdict>(existing?.verdict ?? 'pending');
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const save = useSaveStage();
  const toast = useToast();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate(
      { id: workId, stageId: existing?.id, stage: kind, date: `${date}T09:00:00`, panel, verdict, notes },
      {
        onSuccess: () => {
          toast('Defense tracker updated.', 'success');
          onClose();
        },
      },
    );
  };

  return (
    <Modal
      open={stage !== null}
      onClose={onClose}
      title={existing ? 'Edit stage' : 'Add a stage'}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="stage-form" variant="primary" loading={save.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="stage-form" className={styles.form} onSubmit={submit}>
        <div className={styles.row}>
          <SelectField label="Stage" value={kind} onChange={(e) => setKind(e.target.value as DefenseStageKind)}>
            {(Object.keys(stageLabel) as DefenseStageKind[]).map((k) => (
              <option key={k} value={k}>
                {stageLabel[k]}
              </option>
            ))}
          </SelectField>
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <TextField label="Panel members" value={panel} onChange={(e) => setPanel(e.target.value)} placeholder="Names, separated by commas" maxLength={300} />
        <SelectField label="Verdict" value={verdict} onChange={(e) => setVerdict(e.target.value as Verdict)}>
          {(Object.keys(verdictLabel) as Verdict[]).map((v) => (
            <option key={v} value={v}>
              {verdictLabel[v]}
            </option>
          ))}
        </SelectField>
        <TextField label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        {save.error && (
          <p className={styles.error} role="alert">
            {save.error.message}
          </p>
        )}
      </form>
    </Modal>
  );
}
