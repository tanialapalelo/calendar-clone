'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatIsoDate, parseIsoDateOrToday } from '@/lib/date';
import { CalendarShell } from '@/components/calendar/CalendarShell';
import { useEventsStorage } from '@/lib/events/storage';
import { CreateEventModal } from '@/components/calendar/events/CreateEventModal';
import { EventPopover } from '@/components/calendar/events/EventPopover';
import { DayEventsPopover } from '@/components/calendar/events/DayEventsPopover';
import { eventsForDay } from '@/lib/events/day';

function parseView(value: string | null): CalendarView {
  if (value === 'year' || value === 'month' || value === 'day') return value;
  return 'month';
}

export default function CalendarPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const { events, addEvent, updateEvent, removeEvent } = useEventsStorage();
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverEventId, setPopoverEventId] = useState<string | null>(null);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);

  const [dayPopoverOpen, setDayPopoverOpen] = useState(false);
  const [dayPopoverDate, setDayPopoverDate] = useState<Date | null>(null);
  const [dayPopoverRect, setDayPopoverRect] = useState<DOMRect | null>(null);

  const view = useMemo(() => parseView(searchParams.get('view')), [searchParams]);
  const date = useMemo(() => parseIsoDateOrToday(searchParams.get('date')), [searchParams]);
  const dayPopoverEvents = useMemo(() => {
    if (!dayPopoverDate) return [];
    return eventsForDay(events, dayPopoverDate);
  }, [events, dayPopoverDate]);

  const setQuery = (next: { view?: CalendarView; date?: Date }) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next.view) params.set('view', next.view);
    if (next.date) params.set('date', formatIsoDate(next.date));

    router.replace(`${pathname}?${params.toString()}`);
  };

  const onNavigate = (next: { view?: CalendarView; date?: Date }) => setQuery(next);

  const openCreateForDate = (d: Date) => {
    setCreateDate(d);
    setCreateOpen(true);
  };

  const openEventPopover = (id: string, rect: DOMRect) => {
    setPopoverEventId(id);
    setPopoverRect(rect);
    setPopoverOpen(true);
  };

  const activeEvent = popoverEventId ? (events.find((e) => e.id === popoverEventId) ?? null) : null;

  const openDayPopover = (d: Date, rect: DOMRect) => {
    setDayPopoverDate(d);
    setDayPopoverRect(rect);
    setDayPopoverOpen(true);
  };

  return (
    <>
      <CalendarShell
        view={view}
        date={date}
        events={events}
        onChangeView={(v) => onNavigate({ view: v })}
        onChangeDate={(d) => onNavigate({ date: d })}
        onNavigate={onNavigate}
        onCreateEvent={openCreateForDate}
        onOpenEvent={openEventPopover}
        onOpenDayPopover={openDayPopover}
      />
      <CreateEventModal
        open={createOpen}
        initialDate={createDate ?? date}
        onClose={() => setCreateOpen(false)}
        onCreate={addEvent}
      />
      <EventPopover
        open={popoverOpen}
        anchorRect={popoverRect}
        event={activeEvent}
        onClose={() => setPopoverOpen(false)}
        onUpdate={updateEvent}
        onDelete={removeEvent}
      />
      <DayEventsPopover
        events={dayPopoverEvents}
        anchorRect={dayPopoverRect}
        date={dayPopoverDate}
        open={dayPopoverOpen}
        onClose={() => setDayPopoverOpen(false)}
        disableOutsideClose={popoverOpen}
        onPickEvent={(eventId, rect) => {
          openEventPopover(eventId, rect);
        }}
      />
    </>
  );
}
