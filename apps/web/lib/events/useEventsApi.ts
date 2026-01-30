'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
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

  const addEvent = useCallback(async (evt: CalendarEvent) => {
    const res = await createEvent({
      title: evt.title,
      startAt: evt.start,
      endAt: evt.end,
      allDay: !!evt.allDay,
      description: evt.description,
      location: evt.location,
    });

    if (!res.ok) {
      if (res.status === 401) setUnauthorized(true);
      throw new Error(res.error);
    }

    setEvents((prev) => [...prev, apiEventToCalendarEvent(res.data)]);
  }, []);

  const updateEventById = useCallback(async (next: CalendarEvent) => {
    const res = await updateEvent(next.id, {
      title: next.title,
      startAt: next.start,
      endAt: next.end,
      allDay: !!next.allDay,
      description: next.description ?? '',
      location: next.location ?? '',
    });

    if (!res.ok) {
      if (res.status === 401) setUnauthorized(true);
      throw new Error(res.error);
    }

    const mapped = apiEventToCalendarEvent(res.data);
    setEvents((prev) => prev.map((e) => (e.id === mapped.id ? mapped : e)));
  }, []);

  const removeEventById = useCallback(async (id: string) => {
    const res = await deleteEvent(id);

    if (!res.ok) {
      if (res.status === 401) setUnauthorized(true);
      throw new Error(res.error);
    }

    setEvents((prev) => prev.filter((e) => e.id !== id));
  }, []);

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
