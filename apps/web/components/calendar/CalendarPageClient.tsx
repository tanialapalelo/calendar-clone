'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatIsoDate, parseIsoDateOrToday } from '@/lib/date';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { useEventsStorage } from '@/lib/events/storage';
import { CreateEventModal } from '@/components/calendar/events/CreateEventModal';

function parseView(value: string | null): CalendarView {
  if (value === 'year' || value === 'month' || value === 'day') return value;
  return 'month';
}

export default function CalendarPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { events, addEvent } = useEventsStorage();
  const [createOpen, setCreateOpen] = useState(false);

  const view = useMemo(() => parseView(searchParams.get('view')), [searchParams]);
  const date = useMemo(() => parseIsoDateOrToday(searchParams.get('date')), [searchParams]);

  const setQuery = (next: { view?: CalendarView; date?: Date }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next.view) params.set('view', next.view);
    if (next.date) params.set('date', formatIsoDate(next.date));

    router.replace(`${pathname}?${params.toString()}`);
  };

  const onNavigate = (next: { view?: CalendarView; date?: Date }) => setQuery(next);

  return (
    <>
      <CalendarShell
        view={view}
        date={date}
        events={events}
        onChangeView={(v) => onNavigate({ view: v })}
        onChangeDate={(d) => onNavigate({ date: d })}
        onNavigate={onNavigate}
        onCreateEvent={() => setCreateOpen(true)}
      />
      <CreateEventModal
        open={createOpen}
        initialDate={date}
        onClose={() => setCreateOpen(false)}
        onCreate={addEvent}
      />
    </>
  );
}
