import { apiFetch } from './client';

export type ApiEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  startAt: string; // ISO
  endAt: string; // ISO
  timeZone: string | null;
  createdAt: string;
  updatedAt: string;
};

export function apiEventToCalendarEvent(ev: ApiEvent): CalendarEvent {
  return {
    id: ev.id,
    title: ev.title,
    start: ev.startAt,
    end: ev.endAt,
    allDay: ev.allDay,
    description: ev.description ?? undefined,
    location: ev.location ?? undefined,
    recurrence: null,
    guests: undefined,
    notifications: undefined,
    color: '#0B57D0',
    visibility: 'default',
    busyStatus: 'busy',
  };
}

export async function listEvents(params: { from: Date; to: Date }) {
  const qs = new URLSearchParams({
    from: params.from.toISOString(),
    to: params.to.toISOString(),
  });
  return apiFetch<ApiEvent[]>(`/v1/events?${qs.toString()}`);
}

export async function createEvent(input: {
  title: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  description?: string;
  location?: string;
}) {
  return apiFetch<ApiEvent>('/v1/events', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export async function getEvent(id: string) {
  return apiFetch<ApiEvent>(`/v1/events/${encodeURIComponent(id)}`);
}

export async function updateEvent(
  id: string,
  input: Partial<{
    title: string;
    startAt: string;
    endAt: string;
    allDay: boolean;
    description: string;
    location: string;
  }>,
) {
  return apiFetch<ApiEvent>(`/v1/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function deleteEvent(id: string) {
  return apiFetch<{ ok: true }>(`/v1/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}
