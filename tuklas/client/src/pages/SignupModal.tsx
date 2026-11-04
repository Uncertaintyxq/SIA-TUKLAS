/**
 * SignupModal — the sign-up dialog where new students and educators create an account.
 * On success it sends the new user to "/portfolio". The school comes from the email domain; without
 * a school email the person picks it, and its admins confirm the account (docs/decisions/0002).
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSignup } from '../api/auth';
import { schoolForEmail, useInstitutions } from '../api/institutions';
import { firstName } from '../lib/format';
import { Button } from '../components/ui/Button';
import { SelectField, TextField } from '../components/ui/Field';
import { Modal } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import styles from './SignupModal.module.css';

const blank = { name: '', email: '', password: '', role: 'student' as 'student' | 'educator', program: '', school: '', privacy: false };

export function SignupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [form, setForm] = useState(blank);
  const signup = useSignup();
  const toast = useToast();
  const navigate = useNavigate();
  const { data: schools } = useInstitutions(open);
  const matched = schoolForEmail(schools, form.email);
  // '' follows the email; picking another school than the email's means its admins confirm the account
  const school = form.school || (matched ? String(matched.id) : '');
  const waits = Boolean(school) && school !== String(matched?.id ?? '');
  const set = (k: Exclude<keyof typeof blank, 'privacy'>) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const { name, email, password, role, program, privacy } = form;
    signup.mutate({ name, email, password, role, program, privacy, institutionId: waits ? Number(school) : null }, {
      onSuccess: ({ user }) => {
        toast(`Welcome to Tuklas, ${firstName(user.name)}.`, 'success');
        navigate('/portfolio', { replace: true });
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create your account"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" form="signup-form" variant="primary" loading={signup.isPending}>
            Create account
          </Button>
        </>
      }
    >
      <form id="signup-form" className={styles.form} onSubmit={submit}>
        <TextField label="Full name" autoComplete="name" value={form.name} onChange={set('name')} required />
        <TextField label="School email" type="email" autoComplete="email" placeholder="you@tuklas.edu" value={form.email} onChange={set('email')} required />
        <TextField label="Password" type="password" autoComplete="new-password" hint="At least 12 characters. A short phrase is easy to remember." value={form.password} onChange={set('password')} required minLength={12} />
        {(schools?.length ?? 0) > 0 && (
          <SelectField
            label="School"
            value={school}
            onChange={set('school')}
            required
            hint={
              waits
                ? 'Your school’s admins will confirm your account before you can use Tuklas. With your school email, you’re in straight away.'
                : matched
                  ? 'From your email address.'
                  : 'Use your school email, or pick your school and its admins will confirm you.'
            }
          >
            <option value="">Choose your school</option>
            {schools!.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </SelectField>
        )}
        <div className={styles.row}>
          <SelectField label="I am a" value={form.role} onChange={set('role')}>
            <option value="student">Student</option>
            <option value="educator">Educator / Research adviser</option>
          </SelectField>
          <TextField label="Program or department" placeholder="BS Psychology" value={form.program} onChange={set('program')} required />
        </div>
        <label className={styles.consent}>
          <input type="checkbox" checked={form.privacy} onChange={(e) => setForm((f) => ({ ...f, privacy: e.target.checked }))} required />
          <span>
            I have read the{' '}
            <a href="/privacy" target="_blank" rel="noreferrer">
              privacy notice
            </a>{' '}
            and agree that Tuklas may process my data as it describes.
          </span>
        </label>
        {signup.error && (
          <p className={styles.error} role="alert">
            {signup.error.message}
          </p>
        )}
        <p className={styles.hint}>Admin accounts are issued by the Office of Research.</p>
      </form>
    </Modal>
  );
}
