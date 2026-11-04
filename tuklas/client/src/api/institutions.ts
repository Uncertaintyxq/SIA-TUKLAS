/**
 * Schools API hooks (docs/decisions/0002) — the schools people can sign up to, and the super-admins'
 * list of every school with adding and editing.
 */
import { useQuery } from '@tanstack/react-query';
import type { AdminInstitution, InstitutionInput } from '../types/admin';
import type { DepartmentCard, InstitutionCard } from '../types/common';
import { api } from './client';
import { useAction } from './mutate';

export type { AdminInstitution, InstitutionInput };

export type SignupInstitution = InstitutionCard & { emailDomains: string[] };

export const useInstitutions = (enabled = true) =>
  useQuery({
    queryKey: ['institutions'],
    queryFn: () => api<SignupInstitution[]>('/institutions'),
    enabled,
  });

export const useAdminInstitutions = (enabled: boolean) =>
  useQuery({
    queryKey: ['admin', 'institutions'],
    queryFn: () => api<AdminInstitution[]>('/admin/institutions'),
    enabled,
  });

export const useSaveInstitution = () =>
  useAction(({ id, ...input }: InstitutionInput & { id?: number }) =>
    id ? api(`/admin/institutions/${id}`, { method: 'PUT', body: input }) : api<{ id: number }>('/admin/institutions', { body: input }),
  );

/** The school an email address belongs to by its domain (subdomains count), like the server's Institution::forEmail. */
export function schoolForEmail(schools: SignupInstitution[] | undefined, email: string): SignupInstitution | undefined {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) return undefined;
  return schools?.find((s) => s.emailDomains.some((d) => domain === d || domain.endsWith(`.${d}`)));
}

/** How a school is labelled on cards: its short name, or its name. */
export const schoolLabel = (s: InstitutionCard) => s.shortName || s.name;

/** A department with its school, so two schools' "College of Computing" can be told apart. */
export const departmentLabel = (d: DepartmentCard) => (d.institution ? `${d.name} · ${schoolLabel(d.institution)}` : d.name);

/** My school's departments (or another school's), for the portfolio's department picker. */
export const useDepartments = (enabled = true) => useQuery({ queryKey: ['departments'], queryFn: () => api<DepartmentCard[]>('/departments'), enabled });

export type AdminDepartment = DepartmentCard & { people: number };
export const useAdminDepartments = (institution: number) =>
  useQuery({
    queryKey: ['admin', 'departments', institution],
    queryFn: () => api<AdminDepartment[]>(`/admin/departments?institution=${institution}`),
    enabled: institution > 0,
  });
export const useSaveDepartment = () =>
  useAction(({ id, institutionId, name }: { id?: number; institutionId: number; name: string }) =>
    id ? api(`/admin/departments/${id}`, { method: 'PUT', body: { name } }) : api<{ id: number }>('/admin/departments', { body: { institutionId, name } }),
  );
export const useDeleteDepartment = () => useAction((id: number) => api(`/admin/departments/${id}`, { method: 'DELETE' }));
