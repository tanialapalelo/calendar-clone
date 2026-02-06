import { apiFetch } from './client';

export type ApiEvent = {
  id: string;
  calendarId: string;
  title: string;
  description: string | null;
  location: string | null;
  allDay: boolean;
  startDate?: string | null; // "YYYY-MM-DD"
  endDate?: string | null; // "YYYY-MM-DD" exclusive
  startAt: string; // ISO
  endAt: string; // ISO
  timeZone: string | null;
  color: string | null;
  recurrenceRule: string | null;
  recurrenceTimeZone: string | null;

  // instance metadata (null for non-recurring)
  recurringEventId: string | null;
  originalStartAt: string | null;
  isRecurringInstance: boolean;

  createdAt: string;
  updatedAt: string;
};

export function normalizeRuleOnly(rule: string | null | undefined) {
  if (!rule) return null;
  const trimmed = rule.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase().startsWith('RRULE:') ? trimmed.slice('RRULE:'.length) : trimmed;
}

export function apiEventToCalendarEvent(ev: ApiEvent): CalendarEvent {
  return {
    id: ev.id,
    title: ev.title,
    start: ev.startAt,
    end: ev.endAt,
    startDate: ev.startDate ?? undefined,
    endDate: ev.endDate ?? undefined,
    allDay: ev.allDay,
    description: ev.description ?? undefined,
    location: ev.location ?? undefined,

    // series-level config (still useful for UI)
    recurrence: ev.recurrenceRule ?? null,
    color: ev.color ?? '#0B57D0',

    // metadata needed to update/delete correctly
    recurringEventId: ev.recurringEventId ?? undefined,
    originalStartAt: ev.originalStartAt ?? undefined,
    isRecurringInstance: ev.isRecurringInstance,

    // not implemented yet
    guests: undefined,
    notifications: undefined,
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
  startDate?: string;
  endDate?: string;
  description?: string;
  location?: string;
  color?: string;
  recurrenceRule?: string | null;
  timeZone?: string;
  recurrenceTimeZone?: string;
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
    startDate?: string;
    endDate?: string;
    description: string;
    location: string;
    color: string | null;
    recurrenceRule: string | null;
    timeZone: string;
    recurrenceTimeZone: string;
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
