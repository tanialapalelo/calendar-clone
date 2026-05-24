'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { parseISO } from 'date-fns';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';
import { createEvent, GuestInput, normalizeRuleOnly } from '@/lib/api/events';
import { ApiError } from '@/lib/api/client';

export default function NewEventClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const dateParam = searchParams?.get('date') ?? undefined;
  const initialDate = dateParam ? parseISO(`${dateParam}T00:00:00`) : new Date();

  // Type guard to assert the UI's guests value matches the GuestInput[] shape
  function isGuestInputArray(x: unknown): x is Array<GuestInput> {
    if (!Array.isArray(x)) return false;
    return x.every((it) => {
      if (typeof it === 'string') return true;
      if (it && typeof it === 'object' && typeof (it as any).email === 'string') return true;
      return false;
    });
  }

  const handleCreate = async (evt: CalendarEvent) => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

    try {
      const guests = isGuestInputArray(evt.guests) ? evt.guests : undefined;

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
        // pass guests as either string[] or {email, permissions[]}[] to preserve permissions
        guests,
        notifications: evt.notifications,
        visibility: evt.visibility,
        busyStatus: evt.busyStatus,
        // Meeting-related fields: forward flags so backend can generate or persist meeting URL
        addMeeting: (evt as any).addMeeting ?? undefined,
        meetingProvider: (evt as any).meetingProvider ?? undefined,
        meetingUrl: (evt as any).meetingUrl ?? undefined,
        meetingData: (evt as any).meetingData ?? undefined,
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
