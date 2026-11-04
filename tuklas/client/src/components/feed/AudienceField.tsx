/**
 * AudienceField — who sees an opportunity or event (docs/decisions/0002): the poster's school, or
 * every school on Tuklas.
 */
import { useMe } from '../../api/auth';
import type { Audience } from '../../types/common';
import { SelectField } from '../ui/Field';

export function AudienceField({ value, onChange }: { value: Audience; onChange: (value: Audience) => void }) {
  const { data: me } = useMe();
  const school = me?.institution?.name ?? 'my school';
  return (
    <SelectField
      label="Who can see it"
      value={value}
      onChange={(e) => onChange(e.target.value as Audience)}
      hint={value === 'school' ? `Only people from ${school}.` : 'Students and educators from every school on Tuklas.'}
    >
      <option value="school">{me?.institution ? `${me.institution.name} only` : 'My school only'}</option>
      <option value="all">Every school</option>
    </SelectField>
  );
}
