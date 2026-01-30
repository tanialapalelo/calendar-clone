'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { EventFullscreenForm } from '@/components/calendar/events/forms/EventFullscreenForm';
import { apiEventToCalendarEvent, deleteEvent, getEvent, updateEvent } from '@/lib/api/events';

export default function EditEventPage() {
  const router = useRouter();
  const params = useParams();
  const id = String(params?.id ?? '');

  const [ev, setEv] = useState<CalendarEvent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    const run = async () => {
      setLoading(true);
      const res = await getEvent(id);

      if (!res.ok) {
        if (res.status === 401) router.replace('/login');
        else console.error('getEvent failed', res.status, res.error);
        setLoading(false);
        return;
      }

      setEv(apiEventToCalendarEvent(res.data));
      setLoading(false);
    };

    void run();
  }, [id, router]);

  if (loading || !ev) return <div className="p-6">Loading…</div>;

  const handleSave = async (updated: CalendarEvent) => {
    const res = await updateEvent(updated.id, {
      title: updated.title,
      startAt: updated.start,
      endAt: updated.end,
      allDay: !!updated.allDay,
      description: updated.description ?? '',
      location: updated.location ?? '',
    });

    if (!res.ok) {
      if (res.status === 401) router.replace('/login');
      else console.error('updateEvent failed', res.status, res.error);
      return;
    }

    router.push('/');
  };

  const handleDelete = async (idToDelete: string) => {
    if (!confirm('Delete this event?')) return;

    const res = await deleteEvent(idToDelete);

    if (!res.ok) {
      if (res.status === 401) router.replace('/login');
      else console.error('deleteEvent failed', res.status, res.error);
      return;
    }

    router.push('/');
  };

  return (
    <div className="p-6">
      <EventFullscreenForm
        event={ev}
        initialDate={new Date(ev.start)}
        onClose={() => router.push('/')}
        onSave={(e) => void handleSave(e)}
        onDelete={(eventId) => void handleDelete(eventId)}
      />
    </div>
  );
}
