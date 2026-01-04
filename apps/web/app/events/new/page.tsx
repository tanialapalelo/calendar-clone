'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEventsStorage } from '@/lib/events/storage';
import { parseISO } from 'date-fns';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';

export default function NewEventPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { addEvent } = useEventsStorage();

  // optional: read date from query (YYYY-MM-DD)
  const dateParam = searchParams?.get('date') ?? undefined;
  const initialDate = dateParam ? parseISO(`${dateParam}T00:00:00`) : new Date();

  const handleCreate = (evt: any) => {
    console.log('Creating event', evt);
    addEvent(evt);
    router.push('/');
  };

  return (
    <div className="p-6">
      <div>
        <EventFullscreenForm
          initialDate={initialDate}
          onClose={() => router.push('/')}
          onCreate={(e) => {
            handleCreate(e);
          }}
        />
      </div>
    </div>
  );
}
