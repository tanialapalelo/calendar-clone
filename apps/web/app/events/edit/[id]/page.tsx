'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';
import { useEventsStorage } from '@/lib/events/storage';

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id ?? '';

  const { events, updateEvent, removeEvent } = useEventsStorage();
  const [ev, setEv] = useState<any | null>(null);

  useEffect(() => {
    if (!id) return;
    const found = events.find((e) => e.id === id) ?? null;
    setEv(found);
  }, [events, id]);

  if (!ev) {
    return <div className="p-6">Loading…</div>;
  }

  const handleSave = async (updated: CalendarEvent) => {
    updateEvent(updated);
    await Promise.resolve();
    router.push('/');
  };

  const handleDelete = (idToDelete: string) => {
    if (!confirm('Delete this event?')) return;
    removeEvent(idToDelete);
    router.push('/');
  };

  return (
    <div className="p-6">
      <div>
        <EventFullscreenForm
          event={ev}
          initialDate={new Date(ev.start)}
          onClose={() => router.push('/')}
          onSave={handleSave}
          onDelete={handleDelete}
        />
      </div>
    </div>
  );
}
