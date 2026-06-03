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
import { useSlowConnection } from '@/lib/hooks/useSlowConnection';

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
  const {
    events,
    addEvent,
    importEvents,
    updateEvent,
    removeEvent,
    unauthorized,
    loading,
    mutating,
  } = useEventsApi(range);

  // True after 6 s of initial loading — signals a likely Render cold-start.
  const isApiSlow = useSlowConnection(loading);

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

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
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
    try {
      const text = await file.text();
      const imported = importEventsFromICS(text);
      if (imported.length === 0) {
        showToast('No events found in file', 'info');
        return;
      }
      // importEvents creates all events then does a single refresh — no per-event skeleton flash
      const failed = await importEvents(imported);
      if (failed > 0) showToast(`${failed} of ${imported.length} event(s) failed to import`, 'error');
      else showToast(`Imported ${imported.length} event(s)`, 'success');
    } catch (err) {
      console.error('[handleImportCalendar]', err);
      showToast('Failed to import calendar file', 'error');
    }
  };

  // ── CRUD wrappers with toast feedback ─────────────────────────────────────
  const handleAddEvent = async (ev: CalendarEvent) => {
    try {
      await addEvent(ev);
      showToast('Event created', 'success');
      return true;
    } catch {
      showToast('Failed to create event', 'error');
      return false;
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
      {/* Thin progress bar so users know a CRUD op is in flight */}
      {mutating && (
        <div className="fixed top-0 left-0 z-[100] h-0.5 w-full animate-pulse bg-[#0B57D0]" />
      )}

      {/* Warm-up banner: shown when the API takes > 6 s to respond.
          Render free tier cold-starts take 30–90 s. Without this, users
          see a silent skeleton and may assume the app is broken. */}
      {isApiSlow && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 z-[90] -translate-x-1/2 flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-lg dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200"
        >
          <svg
            className="h-4 w-4 animate-spin shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 100 16v-4l-3 3 3 3v-4a8 8 0 01-8-8z" />
          </svg>
          <span>API is starting up — this takes up to 60 s on the free tier. Hang tight!</span>
        </div>
      )}
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
        onCreate={handleAddEvent}
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
