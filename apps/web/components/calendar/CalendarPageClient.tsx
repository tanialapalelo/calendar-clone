'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { addDays, addMonths, addWeeks, addYears } from 'date-fns';

import { CalendarShell } from '@/components/calendar/CalendarShell';
import { CreateEventModal } from '@/components/calendar/events/CreateEventModal';
import { DayEventsPopover } from '@/components/calendar/events/DayEventsPopover';
import { EventPopover } from '@/components/calendar/events/EventPopover';

import { exportEventsToICS, importEventsFromICS } from '@/lib/events/ical';
import { useEventsApi } from '@/lib/events/useEventsApi';
import { useCalendarsApi } from '@/lib/calendars/useCalendarsApi';
import { useCalendarNavigation } from '@/lib/hooks/useCalendarNavigation';
import { usePopoverState } from '@/lib/hooks/usePopoverState';
import { useToast } from '@/components/ui/Toast';
import { useKeyboardShortcuts } from '@/lib/hooks/useKeyboardShortcuts';

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
  const { showToast } = useToast();

  // ── URL-driven navigation (view + date + API range) ────────────────────────
  const { view, date, range, navigate } = useCalendarNavigation();

  // ── Calendars data + visibility ────────────────────────────────────────────
  const {
    calendars,
    visibleCalendarIds,
    toggleCalendar,
    createCalendar,
    updateCalendar,
    deleteCalendar,
  } = useCalendarsApi();

  // ── Events data + CRUD ─────────────────────────────────────────────────────
  const { events, addEvent, updateEvent, removeEvent, unauthorized, loading } = useEventsApi(range);

  // ── Filter events by visible calendars ─────────────────────────────────────
  const visibleEvents = useMemo(() => {
    if (visibleCalendarIds.size === 0) return events;
    return events.filter((ev) => !ev.calendarId || visibleCalendarIds.has(ev.calendarId));
  }, [events, visibleCalendarIds]);

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
  } = usePopoverState(visibleEvents);

  // ── Create modal ───────────────────────────────────────────────────────────
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | null>(null);
  const [createKind, setCreateKind] = useState<CreateKind>('event');

  const openCreateForDate = (d: Date, kind: CreateKind = 'event') => {
    setCreateDate(d);
    setCreateKind(kind);
    setCreateOpen(true);
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useKeyboardShortcuts({
    onToday: () => navigate({ date: new Date() }),
    onPrev: () => {
      if (view === 'year') navigate({ date: addYears(date, -1) });
      else if (view === 'month') navigate({ date: addMonths(date, -1) });
      else if (view === 'week') navigate({ date: addWeeks(date, -1) });
      else navigate({ date: addDays(date, -1) });
    },
    onNext: () => {
      if (view === 'year') navigate({ date: addYears(date, 1) });
      else if (view === 'month') navigate({ date: addMonths(date, 1) });
      else if (view === 'week') navigate({ date: addWeeks(date, 1) });
      else navigate({ date: addDays(date, 1) });
    },
    onChangeView: (v) => navigate({ view: v }),
    onNewEvent: () => openCreateForDate(date, 'event'),
  });

  // ── Auth redirect ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (unauthorized) router.replace('/login');
  }, [unauthorized, router]);

  // ── Export / Import ────────────────────────────────────────────────────────
  const handleExportCalendar = () => {
    const ics = exportEventsToICS(visibleEvents);
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
    let failed = 0;
    for (const ev of imported) {
      try {
        // eslint-disable-next-line no-await-in-loop
        await addEvent(ev);
      } catch {
        failed++;
      }
    }
    if (failed > 0) showToast(`${failed} event(s) failed to import`, 'error');
    else if (imported.length > 0) showToast(`Imported ${imported.length} event(s)`, 'success');
    else showToast('No events found in file', 'info');
  };

  // ── CRUD wrappers with toast feedback ─────────────────────────────────────
  const handleAddEvent = async (ev: CalendarEvent) => {
    try {
      await addEvent(ev);
      showToast('Event created', 'success');
    } catch {
      showToast('Failed to create event', 'error');
    }
  };

  const handleUpdateEvent = async (...args: Parameters<typeof updateEvent>) => {
    try {
      await updateEvent(...args);
      showToast('Event updated', 'success');
    } catch {
      showToast('Failed to update event', 'error');
    }
  };

  const handleRemoveEvent = async (...args: Parameters<typeof removeEvent>) => {
    try {
      await removeEvent(...args);
      showToast('Event deleted', 'success');
    } catch {
      showToast('Failed to delete event', 'error');
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <CalendarShell
        view={view}
        date={date}
        events={visibleEvents}
        loading={loading}
        calendars={calendars}
        visibleCalendarIds={visibleCalendarIds}
        onToggleCalendar={toggleCalendar}
        onCreateCalendar={createCalendar}
        onUpdateCalendar={updateCalendar}
        onDeleteCalendar={deleteCalendar}
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
        initialKind={createKind}
        calendars={calendars}
        onClose={() => setCreateOpen(false)}
        onCreate={(ev) => {
          void handleAddEvent(ev);
        }}
      />

      <EventPopover
        key={eventPopoverKey}
        open={eventPopoverOpen}
        anchorRect={eventPopoverRect}
        event={activeEvent}
        onClose={closeEventPopover}
        onUpdate={handleUpdateEvent}
        onDelete={handleRemoveEvent}
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
