'use client';

import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { addDays, startOfDay, startOfWeek, endOfWeek } from 'date-fns';

import { CalendarShell } from '@/components/calendar/CalendarShell';
import { CreateEventModal } from '@/components/calendar/events/CreateEventModal';
import { DayEventsPopover } from '@/components/calendar/events/DayEventsPopover';
import { EventPopover } from '@/components/calendar/events/EventPopover';

import { formatIsoDate, parseIsoDateOrToday } from '@/lib/date';
import { exportEventsToICS, importEventsFromICS } from '@/lib/events/ical';
import { useEventsApi } from '@/lib/events/useEventsApi';
import { generateMonthGrid } from '@/lib/month-grid';

function parseView(value: string | null): CalendarView {
  if (value === 'year' || value === 'month' || value === 'week' || value === 'day') return value;
  return 'month';
}

export default function CalendarPageClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const view = useMemo(() => parseView(searchParams.get('view')), [searchParams]);
  const date = useMemo(() => parseIsoDateOrToday(searchParams.get('date')), [searchParams]);

  const range = useMemo(() => {
    if (view === 'day') {
      const from = startOfDay(date);
      const to = addDays(from, 1);
      return { from, to };
    }
    if (view === 'week') {
      const from = startOfDay(startOfWeek(date, { weekStartsOn: 0 }));
      const to = addDays(startOfDay(endOfWeek(date, { weekStartsOn: 0 })), 1);
      return { from, to };
    }
    if (view === 'year') {
      const from = new Date(date.getFullYear(), 0, 1);
      const to = new Date(date.getFullYear() + 1, 0, 1);
      return { from, to };
    }
    // month: use the 42-cell grid
    const cells = generateMonthGrid(date);
    const from = startOfDay(cells[0].date);
    const to = addDays(startOfDay(cells[cells.length - 1].date), 1);
    return { from, to };
  }, [view, date]);

  const { events, addEvent, updateEvent, removeEvent, unauthorized, loading } = useEventsApi(range);

  // Redirect to login if user is not authenticated
  useEffect(() => {
    if (unauthorized) router.replace('/login');
  }, [unauthorized, router]);

  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverEventId, setPopoverEventId] = useState<string | null>(null);
  const [popoverRect, setPopoverRect] = useState<DOMRect | null>(null);

  const [dayPopoverOpen, setDayPopoverOpen] = useState(false);
  const [dayPopoverDate, setDayPopoverDate] = useState<Date | null>(null);
  const [dayPopoverRect, setDayPopoverRect] = useState<DOMRect | null>(null);

  const activeEvent = useMemo(() => {
    if (!popoverEventId) return null;

    // direct match (instance id or master id if masters are returned)
    const direct = events.find((e) => e.id === popoverEventId);
    if (direct) return direct;

    // If popoverEventId is a master id, pick the best matching instance.
    // Prefer the one nearest to the anchor rect (the thing the user clicked).
    const candidates = events.filter((e) => e.recurringEventId === popoverEventId);
    if (candidates.length === 0) return null;

    if (popoverRect) {
      // We don't have each event's DOMRect, but we can approximate:
      // choose by date proximity to the day column under the anchor.
      // Fallback: choose the one with the smallest startAt in the current range.
      // (Better fix is Fix 1: pass instance id into openEventPopover.)
      // Here we just pick the earliest candidate to keep deterministic behavior.
      // You can improve this once you pass actual instance ids.
      return candidates[0] ?? null;
    }

    return candidates[0] ?? null;
  }, [events, popoverEventId, popoverRect]);

  const dayPopoverEvents = useMemo(() => {
    if (!dayPopoverDate) return [];
    const dayStart = startOfDay(dayPopoverDate);
    const dayEnd = addDays(dayStart, 1);

    return events.filter((e) => {
      const start = new Date(e.start).getTime();
      const end = new Date(e.end).getTime();
      return end > dayStart.getTime() && start < dayEnd.getTime();
    });
  }, [events, dayPopoverDate]);

  const popoverKey = activeEvent?.id ?? popoverEventId ?? 'popover';

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

  const openDayPopover = (d: Date, rect: DOMRect) => {
    setDayPopoverDate(d);
    setDayPopoverRect(rect);
    setDayPopoverOpen(true);
  };

  const handleExportCalendar = () => {
    const ics = exportEventsToICS(events);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'calendar.ics';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportCalendar = async (file: File) => {
    const text = await file.text();
    const imported = importEventsFromICS(text);

    for (const ev of imported) {
      // eslint-disable-next-line no-await-in-loop
      await addEvent(ev);
    }
  };

  return (
    <>
      <CalendarShell
        view={view}
        date={date}
        events={events}
        loading={loading}
        onChangeView={(v) => onNavigate({ view: v })}
        onChangeDate={(d) => onNavigate({ date: d })}
        onNavigate={onNavigate}
        onCreateEvent={openCreateForDate}
        onOpenEvent={openEventPopover}
        onOpenDayPopover={openDayPopover}
        onExportCalendar={handleExportCalendar}
        onImportCalendar={handleImportCalendar}
      />

      <CreateEventModal
        open={createOpen}
        initialDate={createDate ?? date}
        onClose={() => setCreateOpen(false)}
        onCreate={(ev) => {
          void addEvent(ev);
        }}
      />

      <EventPopover
        key={popoverKey}
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
