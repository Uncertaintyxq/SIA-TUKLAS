/**
 * Events API hooks — events, registrations and event ads.
 */
import { useQuery } from '@tanstack/react-query';
import type { AdCard, AdInput, EventCard, EventCategory, EventDetail, EventInput, EventsResponse } from '../types/events';
import { api, upload } from './client';
import { useAction } from './mutate';

export type { AdCard, EventCard, EventCategory, EventDetail };

export const useEvents = () => useQuery({ queryKey: ['events'], queryFn: () => api<EventsResponse>('/events') });

export function useEvent(id: number) {
  return useQuery({ queryKey: ['event', id], queryFn: () => api<EventDetail>(`/events/${id}`), enabled: Number.isInteger(id) && id > 0, retry: false });
}

export const useCreateEvent = () => useAction((input: EventInput) => api<{ id: number; status: string }>('/events', { body: input }));
export const useDeleteEvent = () => useAction((id: number) => api(`/events/${id}`, { method: 'DELETE' }));
export const useRegister = () =>
  useAction(({ id, register }: { id: number; register: boolean }) => api(`/events/${id}/register`, { method: register ? 'POST' : 'DELETE' }));

export const useCreateAd = () =>
  useAction(async ({ eventId, image, ...input }: AdInput & { eventId: number; image: File | null }) => {
    const ad = await api<{ id: number; status: string }>(`/events/${eventId}/ads`, { body: input });
    if (image) await upload(`/ads/${ad.id}/image`, image);
    return ad;
  });
export const useDeleteAd = () => useAction((id: number) => api(`/ads/${id}`, { method: 'DELETE' }));
