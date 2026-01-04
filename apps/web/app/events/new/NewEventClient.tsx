'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { parseISO } from 'date-fns';
import { useEventsStorage } from '@/lib/events/storage';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';

export default function NewEventClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addEvent } = useEventsStorage();

  const dateParam = searchParams?.get('date') ?? undefined;
  const initialDate = dateParam ? parseISO(`${dateParam}T00:00:00`) : new Date();

  const handleCreate = (evt: CalendarEvent) => {
    addEvent(evt);
    router.push('/');
  };

  return (
    <EventFullscreenForm
      initialDate={initialDate}
      onClose={() => router.push('/')}
      onCreate={handleCreate}
    />
  );
}
