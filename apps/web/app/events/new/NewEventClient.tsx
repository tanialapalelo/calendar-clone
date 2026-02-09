'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { parseISO } from 'date-fns';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';
import { createEvent, normalizeRuleOnly } from '@/lib/api/events';

export default function NewEventClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateParam = searchParams?.get('date') ?? undefined;
  const initialDate = dateParam ? parseISO(`${dateParam}T00:00:00`) : new Date();

  const handleCreate = async (evt: CalendarEvent) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const res = await createEvent({
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
    });

    if (!res.ok) {
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      console.error('createEvent failed', res.status, res.error);
      return;
    }

    router.push('/');
  };

  return (
    <EventFullscreenForm
      initialDate={initialDate}
      onClose={() => router.push('/')}
      onCreate={(evt) => {
        void handleCreate(evt);
      }}
    />
  );
}
