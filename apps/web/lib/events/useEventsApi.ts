'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  normalizeRuleOnly,
  apiEventToCalendarEvent,
  createEvent,
  listEvents,
  updateEvent,
  deleteEvent,
} from '@/lib/api/events';

export function useEventsApi(range: { from: Date; to: Date }) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await listEvents(range);

    if (!res.ok) {
      setLoading(false);

      if (res.status === 401) {
        setUnauthorized(true);
        setEvents([]);
        return;
      }

      console.error('listEvents failed', res.status, res.error);
      setUnauthorized(false);
      setEvents([]);
      return;
    }

    setUnauthorized(false);
    setEvents(res.data.map(apiEventToCalendarEvent));
    setLoading(false);
  }, [range]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addEvent = useCallback(
    async (evt: CalendarEvent) => {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

      const res = await createEvent({
        title: evt.title,
        startAt: evt.start,
        endAt: evt.end,
        allDay: !!evt.allDay,
        startDate: evt.allDay ? evt.start.slice(0, 10) : undefined,
        endDate: evt.allDay ? evt.end.slice(0, 10) : undefined,
        description: evt.description,
        location: evt.location,
        color: evt.color,
        recurrenceRule: normalizeRuleOnly(evt.recurrence ?? null),
        timeZone: tz,
        recurrenceTimeZone: tz,
      });
      if (!res.ok) {
        if (res.status === 401) setUnauthorized(true);
        throw new Error(res.error);
      }

      await refresh();
    },
    [refresh],
  );

  const updateEventById = useCallback(
    async (next: CalendarEvent) => {
      const targetId =
        next.isRecurringInstance && next.recurringEventId ? next.recurringEventId : next.id;

      const res = await updateEvent(targetId, {
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
      });

      if (!res.ok) {
        if (res.status === 401) setUnauthorized(true);
        throw new Error(res.error);
      }

      await refresh();
    },
    [refresh],
  );

  const removeEventById = useCallback(
    async (next: CalendarEvent | string) => {
      const id =
        typeof next === 'string'
          ? next
          : next.isRecurringInstance && next.recurringEventId
            ? next.recurringEventId
            : next.id;

      const res = await deleteEvent(id);

      if (!res.ok) {
        if (res.status === 401) setUnauthorized(true);
        throw new Error(res.error);
      }

      await refresh();
    },
    [refresh],
  );

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
