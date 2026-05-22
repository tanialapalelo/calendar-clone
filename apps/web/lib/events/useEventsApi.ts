'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  apiEventToCalendarEvent,
  createEvent,
  deleteEvent,
  listEvents,
  normalizeRuleOnly,
  type RecurrenceScope,
  updateEvent,
} from '@/lib/api/events';
import { ApiError } from '@/lib/api/client';

// ---------------------------------------------------------------------------
// Helpers for recurring event ID resolution
// ---------------------------------------------------------------------------

/** Extract master event ID from a virtual instance ID like "masterId@isoDate". */
function getMasterIdFromInstanceId(id: string): string | null {
  const at = id.indexOf('@');
  if (at <= 0) return null;
  const iso = id.slice(at + 1);
  if (Number.isNaN(new Date(iso).getTime())) return null;
  return id.slice(0, at);
}

/** Get the virtual instance ID for a recurring event instance. */
function getInstanceId(event: CalendarEvent): string | null {
  if (event.id.includes('@')) return event.id;
  if (event.recurringEventId && event.originalStartAt) {
    return `${event.recurringEventId}@${event.originalStartAt}`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useEventsApi(range: { from: Date; to: Date }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listEvents(range);
      setUnauthorized(false);
      setEvents(data.map(apiEventToCalendarEvent));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setUnauthorized(true);
        setEvents([]);
      } else {
        // Non-auth error (network, 5xx) — keep existing events, log for debugging
        console.error('[useEventsApi] listEvents failed:', err);
        setUnauthorized(false);
      }
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addEvent = useCallback(
    async (evt: CalendarEvent) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      try {
        await createEvent({
          title: evt.title,
          startAt: evt.start,
          endAt: evt.end,
          allDay: !!evt.allDay,
          startDate: evt.allDay ? evt.start.slice(0, 10) : undefined,
          endDate: evt.allDay ? evt.end.slice(0, 10) : undefined,
          description: evt.description,
          location: evt.location,
          color: evt.color,
          calendarId: evt.calendarId,
          recurrenceRule: normalizeRuleOnly(evt.recurrence ?? null),
          timeZone: tz,
          recurrenceTimeZone: tz,
          // allow guests to be either string[] or { email, permissions[] }[]; pass through
          guests: evt.guests as any,
          notifications: evt.notifications,
          visibility: evt.visibility,
          busyStatus: evt.busyStatus,
        });
        await refresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setUnauthorized(true);
        throw err;
      }
    },
    [refresh],
  );

  const updateEventById = useCallback(
    async (next: CalendarEvent, scope?: RecurrenceScope) => {
      const isInstance = !!next.isRecurringInstance && !!next.recurringEventId;
      const masterId = next.recurringEventId ?? getMasterIdFromInstanceId(next.id) ?? next.id;
      const instanceId = getInstanceId(next) ?? next.id;
      // For "this" or "following" scopes on instances, use the instance ID.
      // For "all" scope or non-recurring, use the master/regular ID.
      const targetId =
        isInstance && scope && scope !== 'all' ? instanceId : isInstance ? masterId : next.id;

      try {
        await updateEvent(
          targetId,
          {
            title: next.title,
            startAt: next.start,
            endAt: next.end,
            allDay: !!next.allDay,
            startDate: next.allDay ? next.start.slice(0, 10) : undefined,
            endDate: next.allDay ? next.end.slice(0, 10) : undefined,
            description: next.description ?? '',
            location: next.location ?? '',
            color: next.color,
            recurrenceRule: normalizeRuleOnly(next.recurrence ?? null),
            // allow guests with permissions (frontend passes objects) or plain strings
            guests: next.guests as any,
            notifications: next.notifications,
            visibility: next.visibility,
            busyStatus: next.busyStatus,
          },
          scope,
        );
        await refresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setUnauthorized(true);
        throw err;
      }
    },
    [refresh],
  );

  const removeEventById = useCallback(
    async (next: CalendarEvent | string, scope?: RecurrenceScope) => {
      const isInstance =
        typeof next !== 'string' && !!next.isRecurringInstance && !!next.recurringEventId;

      const masterId =
        typeof next === 'string'
          ? next
          : (next.recurringEventId ?? getMasterIdFromInstanceId(next.id) ?? next.id);

      const instanceId = typeof next === 'string' ? next : (getInstanceId(next) ?? next.id);

      const targetId =
        typeof next === 'string'
          ? next
          : isInstance && scope && scope !== 'all'
            ? instanceId
            : isInstance
              ? masterId
              : next.id;

      try {
        await deleteEvent(String(targetId), scope);
        await refresh();
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) setUnauthorized(true);
        throw err;
      }
    },
    [refresh],
  );

  // useMemo so consumers get a stable object reference when nothing changed
  return useMemo(
    () => ({
      events,
      loading,
      unauthorized,
      refresh,
      addEvent,
      updateEvent: updateEventById,
      removeEvent: removeEventById,
    }),
    [events, loading, unauthorized, refresh, addEvent, updateEventById, removeEventById],
  );
}
