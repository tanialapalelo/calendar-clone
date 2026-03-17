'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import { CalendarShell } from '@/components/calendar/CalendarShell';
import { CreateEventModal } from '@/components/calendar/events/CreateEventModal';
import { DayEventsPopover } from '@/components/calendar/events/DayEventsPopover';
import { EventPopover } from '@/components/calendar/events/EventPopover';

import { exportEventsToICS, importEventsFromICS } from '@/lib/events/ical';
import { useEventsApi } from '@/lib/events/useEventsApi';
import { useCalendarNavigation } from '@/lib/hooks/useCalendarNavigation';
import { usePopoverState } from '@/lib/hooks/usePopoverState';

// ---------------------------------------------------------------------------
// CalendarPageClient
//
// Responsibilities (only these — everything else is in hooks):
//   1. Compose the three domain hooks
//   2. Handle the create-event modal open/close
//   3. Handle export / import
//   4. Render the shell + modals
// ---------------------------------------------------------------------------

export default function CalendarPageClient() {
  const router = useRouter();

  // ── URL-driven navigation (view + date + API range) ────────────────────────
  const { view, date, range, navigate } = useCalendarNavigation();

  // ── Events data + CRUD ─────────────────────────────────────────────────────
  const { events, addEvent, updateEvent, removeEvent, unauthorized, loading } = useEventsApi(range);

  // ── Popover state ──────────────────────────────────────────────────────────
  const {
    eventPopoverOpen,
    eventPopoverRect,
    activeEvent,
    openEventPopover,
    closeEventPopover,
    eventPopoverKey,
    dayPopoverOpen,
    dayPopoverDate,
    dayPopoverRect,
    dayPopoverEvents,
    openDayPopover,
    closeDayPopover,
  } = usePopoverState(events);

  // ── Create modal ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);

  const openCreateForDate = (d: Date) => {
    setCreateDate(d);
    setCreateOpen(true);
  };

  // ── Auth redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (unauthorized) router.replace('/login');
  }, [unauthorized, router]);

  // ── Export / Import ────────────────────────────────────────────────────────
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
      // Sequential import to preserve order and avoid race conditions
      // eslint-disable-next-line no-await-in-loop
      await addEvent(ev);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <CalendarShell
        view={view}
        date={date}
        events={events}
        loading={loading}
        onChangeView={(v) => navigate({ view: v })}
        onChangeDate={(d) => navigate({ date: d })}
        onNavigate={navigate}
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
        key={eventPopoverKey}
        open={eventPopoverOpen}
        anchorRect={eventPopoverRect}
        event={activeEvent}
        onClose={closeEventPopover}
        onUpdate={updateEvent}
        onDelete={removeEvent}
      />

      <DayEventsPopover
        events={dayPopoverEvents}
        anchorRect={dayPopoverRect}
        date={dayPopoverDate}
        open={dayPopoverOpen}
        onClose={closeDayPopover}
        disableOutsideClose={eventPopoverOpen}
        onPickEvent={(eventId, rect) => openEventPopover(eventId, rect)}
      />
    </>
  );
}
