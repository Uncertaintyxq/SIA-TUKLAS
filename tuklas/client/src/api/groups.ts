/**
 * Groups API hooks — research groups and their members, files, deadlines, deliverables and channels.
 */
import { useQuery } from '@tanstack/react-query';
import type { ChannelInput } from '../types/chat';
import type { DeadlineInput, DeliverableDetail, DeliverableSubmission, GroupDetail, GroupInput, GroupRole, GroupSummary, SubmissionStatus } from '../types/groups';
import { api, upload } from './client';
import { useAction } from './mutate';

export type { DeliverableDetail, DeliverableSubmission, GroupDetail, GroupRole, GroupSummary };

export const useGroups = () => useQuery({ queryKey: ['groups'], queryFn: () => api<GroupSummary[]>('/groups') });

export function useGroup(id: number) {
  return useQuery({ queryKey: ['group', id], queryFn: () => api<GroupDetail>(`/groups/${id}`), enabled: Number.isInteger(id) && id > 0, retry: false });
}

export const useCreateGroup = () => useAction((input: GroupInput) => api<{ id: number }>('/groups', { body: input }));
export const useUpdateGroup = () => useAction(({ id, ...input }: GroupInput & { id: number }) => api(`/groups/${id}`, { method: 'PATCH', body: input }));
export const useDeleteGroup = () => useAction((id: number) => api(`/groups/${id}`, { method: 'DELETE' }));
export const useAddMember = () => useAction(({ id, userId }: { id: number; userId: number }) => api(`/groups/${id}/members`, { body: { userId } }));
export const useSetMemberRole = () =>
  useAction(({ id, userId, role }: { id: number; userId: number; role: GroupRole }) =>
    api(`/groups/${id}/members/${userId}`, { method: 'PATCH', body: { role } }),
  );
export const useRemoveMember = () =>
  useAction(({ id, userId }: { id: number; userId: number }) => api(`/groups/${id}/members/${userId}`, { method: 'DELETE' }));
export const useUploadGroupFile = () => useAction(({ id, file }: { id: number; file: File }) => upload(`/groups/${id}/files`, file, 'POST'));
export const useDeleteGroupFile = () =>
  useAction(({ id, fileId }: { id: number; fileId: number }) => api(`/groups/${id}/files/${fileId}`, { method: 'DELETE' }));
export const useAddDeadline = () => useAction(({ id, ...input }: DeadlineInput & { id: number }) => api(`/groups/${id}/deadlines`, { body: input }));
export const useDeleteDeadline = () =>
  useAction(({ id, deadlineId }: { id: number; deadlineId: number }) => api(`/groups/${id}/deadlines/${deadlineId}`, { method: 'DELETE' }));
export const useCreateChannel = () => useAction(({ id, ...input }: ChannelInput & { id: number }) => api<{ id: number }>(`/groups/${id}/channels`, { body: input }));
export const useDeleteChannel = () =>
  useAction(({ id, channelId }: { id: number; channelId: number }) => api(`/groups/${id}/channels/${channelId}`, { method: 'DELETE' }));

export function useDeliverable(groupId: number, deadlineId: number) {
  return useQuery({ queryKey: ['group', groupId, 'deliverable', deadlineId], queryFn: () => api<DeliverableDetail>(`/groups/${groupId}/deadlines/${deadlineId}`) });
}

/** Hands in a file (replacing any earlier one), then saves the note to the reviewers if there is one. */
export const useHandIn = () =>
  useAction(async ({ groupId, deadlineId, file, note }: { groupId: number; deadlineId: number; file: File; note: string }) => {
    const path = `/groups/${groupId}/deadlines/${deadlineId}/submission`;
    const submission = await upload<DeliverableSubmission>(path, file, 'PUT');
    return note.trim() ? api<DeliverableSubmission>(path, { method: 'PATCH', body: { note } }) : submission;
  });

export const useReviewSubmission = () =>
  useAction(
    ({ groupId, deadlineId, submissionId, ...input }: { groupId: number; deadlineId: number; submissionId: number; status: Exclude<SubmissionStatus, 'submitted'>; feedback: string }) =>
      api<DeliverableSubmission>(`/groups/${groupId}/deadlines/${deadlineId}/submissions/${submissionId}/review`, { body: input }),
  );
