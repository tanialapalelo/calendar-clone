'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { parseISO } from 'date-fns';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';
import { createEvent, normalizeRuleOnly } from '@/lib/api/events';
import { ApiError } from '@/lib/api/client';

export default function NewEventClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateParam = searchParams?.get('date') ?? undefined;
  const initialDate = dateParam ? parseISO(`${dateParam}T00:00:00`) : new Date();

  const handleCreate = async (evt: CalendarEvent) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      await createEvent({
        title: evt.title,
        startAt: evt.start,
        endAt: evt.end,
        allDay: evt.allDay,
        startDate: evt.allDay ? (evt.startDate ?? undefined) : undefined,
        endDate: evt.allDay ? (evt.endDate ?? undefined) : undefined,
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

      // Success — go back to the calendar
      router.push('/');
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace('/login');
        return;
      }
      console.error('createEvent failed', err);
    }
  };

  return (
    <EventFullscreenForm
      key={initialDate.toISOString()}
      initialDate={initialDate}
      onClose={() => router.push('/')}
      onCreate={(evt) => {
        void handleCreate(evt);
      }}
    />
  );
}
