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

function getMasterIdFromInstanceId(id: string): string | null {
  const at = id.indexOf('@');
  if (at <= 0) return null;
  const iso = id.slice(at + 1);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return id.slice(0, at);
}

function getInstanceId(event: CalendarEvent): string | null {
  if (event.id.includes('@')) return event.id;
  if (event.recurringEventId && event.originalStartAt) {
    return `${event.recurringEventId}@${event.originalStartAt}`;
  }
  return null;
}

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
        guests: evt.guests,
        notifications: evt.notifications,
        visibility: evt.visibility,
        busyStatus: evt.busyStatus,
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
    async (next: CalendarEvent, scope?: 'this' | 'following' | 'all') => {
      const isInstance = !!next.isRecurringInstance && !!next.recurringEventId;
      const masterId = next.recurringEventId ?? getMasterIdFromInstanceId(next.id) ?? next.id;
      const instanceId = getInstanceId(next) ?? next.id;
      const targetId =
        isInstance && scope && scope !== 'all' ? instanceId : isInstance ? masterId : next.id;

      const res = await updateEvent(
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
          guests: next.guests,
          notifications: next.notifications,
          visibility: next.visibility,
          busyStatus: next.busyStatus,
        },
        scope,
      );

      if (!res.ok) {
        if (res.status === 401) setUnauthorized(true);
        throw new Error(res.error);
      }

      await refresh();
    },
    [refresh],
  );

  const removeEventById = useCallback(
    async (next: CalendarEvent | string, scope?: 'this' | 'following' | 'all') => {
      const isInstance =
        typeof next !== 'string' && next.isRecurringInstance && next.recurringEventId;

      const masterId =
        typeof next === 'string'
          ? next
          : (next.recurringEventId ?? getMasterIdFromInstanceId(next.id) ?? next.id);

      const instanceId = typeof next === 'string' ? next : (getInstanceId(next) ?? next.id);

      const rawId =
        typeof next === 'string'
          ? next
          : isInstance && scope && scope !== 'all'
            ? instanceId
            : isInstance
              ? masterId
              : next.id;

      const targetId = String(rawId);

      const res = await deleteEvent(targetId, scope);

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
