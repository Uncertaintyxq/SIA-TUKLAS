/**
 * WorkBadges — the colored type tag and status badge shown on works.
 */
import type { WorkStatus, WorkType } from '@server/schemas/works';
import { statusLabel, typeLabel } from '../../lib/labels';
import { Badge, type BadgeTone } from '../ui/Badge';

const typeTone: Record<WorkType, BadgeTone> = { research: 'purple', literary: 'blue', innovation: 'gold' };

export function TypeTag({ type }: { type: WorkType }) {
  return <Badge tone={typeTone[type]}>{typeLabel[type]}</Badge>;
}

const statusTone: Record<WorkStatus, BadgeTone> = {
  draft: 'neutral',
  submitted: 'gold',
  under_review: 'blue',
  revision: 'warn',
  approved: 'ok',
  rejected: 'bad',
};

export function StatusBadge({ status, removed = false }: { status: WorkStatus; removed?: boolean }) {
  if (removed) return <Badge tone="bad">Removed by admin</Badge>;
  return <Badge tone={statusTone[status]}>{statusLabel[status]}</Badge>;
}
